'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeUSDC } from '@/lib/format'
import { getAvailableCapital } from '@/lib/capital'
import { useWallet } from '@/hooks/use-wallet'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { PollarWalletKitLimitations } from '@/lib/mercato-wallet'
import type { SendTransactionResponse } from '@defindex/sdk'

type VaultAction<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  ...args: TArgs
) => Promise<TResult>

interface UseDefindexOptions {
  depositToVaultAction?: VaultAction
  withdrawFromVaultAction?: VaultAction
}

export type MercatoVaultMeta = {
  vaultAddress: string
  network: string
  name: string
  symbol: string
  apy: number
  feesBps: { vaultFee: number; defindexFee: number }
  assets?: Array<{ address: string; name?: string; symbol?: string; strategies?: unknown[] }>
}

type BalanceApiOk = {
  underlyingTotal: number
  dfTokens: number
  vaultAddress: string
  network: string
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown }
    if (typeof data?.error === 'string' && data.error) return data.error
  } catch {
    /* ignore */
  }
  return `Request failed (${response.status})`
}

/** Skip hammering the API when the browser has no public vault id (same as MercatoVaultActions). */
function hasClientVaultConfigured(): boolean {
  if (typeof process === 'undefined') return false
  return Boolean(
    process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim() ||
      process.env.NEXT_PUBLIC_MERCATO_DEFINDEX_VAULT_ADDRESS?.trim()
  )
}

export const useDefindex = (options?: UseDefindexOptions) => {
  const { walletInfo, balances, refreshBalance, canSignTransactions } = useWallet()
  const walletBalance = useMemo(() => {
    const raw = balances?.usdc
    if (raw == null || raw === '') return 0
    const n = Number(raw)
    return normalizeUSDC(Number.isFinite(n) ? n : 0)
  }, [balances?.usdc])
  const [vaultBalance, setVaultBalance] = useState(0)
  const [dfTokens, setDfTokens] = useState(0)
  const [vaultMeta, setVaultMeta] = useState<MercatoVaultMeta | null>(null)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [vaultInfoError, setVaultInfoError] = useState<string | null>(null)

  const fetchVaultMeta = useCallback(async (): Promise<MercatoVaultMeta | null> => {
    if (!hasClientVaultConfigured()) {
      setVaultInfoError(null)
      setVaultMeta(null)
      return null
    }
    const response = await fetch('/api/defindex/vault', { credentials: 'include' })
    if (!response.ok) {
      setVaultInfoError(await readErrorMessage(response))
      return null
    }
    setVaultInfoError(null)
    const data = (await response.json()) as MercatoVaultMeta
    setVaultMeta(data)
    return data
  }, [])

  const getVaultBalance = useCallback(async (address: string): Promise<number> => {
    if (!address) {
      setVaultBalance(0)
      setDfTokens(0)
      return 0
    }

    if (!hasClientVaultConfigured()) {
      setBalanceError(null)
      setVaultBalance(0)
      setDfTokens(0)
      return 0
    }

    try {
      setIsLoadingBalances(true)
      setBalanceError(null)

      const url = new URL('/api/defindex/balance', window.location.origin)
      url.searchParams.set('caller', address)

      const response = await fetch(url.toString(), { credentials: 'include' })

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const payload = (await response.json()) as BalanceApiOk
      const normalized = normalizeUSDC(payload.underlyingTotal ?? 0)
      setVaultBalance(normalized)
      setDfTokens(
        typeof payload.dfTokens === 'number' && Number.isFinite(payload.dfTokens)
          ? payload.dfTokens
          : 0
      )
      return normalized
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load Mercato vault balance'
      setBalanceError(message)
      setVaultBalance(0)
      setDfTokens(0)
      return 0
    } finally {
      setIsLoadingBalances(false)
    }
  }, [])

  const signAndSubmit = useCallback(
    async (
      unsignedXdr: string,
      signerAddress: string
    ): Promise<SendTransactionResponse> => {
      if (!canSignTransactions) {
        throw new Error(
          `${PollarWalletKitLimitations} Use a Freighter or Albedo wallet via Stellar Wallets Kit to deposit or withdraw from the Mercato vault.`
        )
      }

      const signedXdr = await signTransaction({
        unsignedTransaction: unsignedXdr,
        address: signerAddress,
      })

      const submitResponse = await fetch('/api/defindex/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xdr: signedXdr }),
      })

      if (!submitResponse.ok) {
        throw new Error(await readErrorMessage(submitResponse))
      }

      return (await submitResponse.json()) as SendTransactionResponse
    },
    [canSignTransactions]
  )

  const defaultDeposit = useCallback(
    async (amounts: number[]) => {
      const address = walletInfo?.address
      if (!address) throw new Error('Connect a wallet to deposit')

      const build = await fetch('/api/defindex/deposit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller: address,
          amounts,
          invest: true,
          slippageBps: 100,
        }),
      })

      if (!build.ok) {
        throw new Error(await readErrorMessage(build))
      }

      const { xdr } = (await build.json()) as { xdr: string }
      if (!xdr) throw new Error('No deposit transaction returned from server')

      return signAndSubmit(xdr, address)
    },
    [signAndSubmit, walletInfo?.address]
  )

  const defaultWithdraw = useCallback(
    async (amounts: number[]) => {
      const address = walletInfo?.address
      if (!address) throw new Error('Connect a wallet to withdraw')

      const build = await fetch('/api/defindex/withdraw', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller: address,
          amounts,
          slippageBps: 100,
        }),
      })

      if (!build.ok) {
        throw new Error(await readErrorMessage(build))
      }

      const { xdr } = (await build.json()) as { xdr: string }
      if (!xdr) throw new Error('No withdraw transaction returned from server')

      return signAndSubmit(xdr, address)
    },
    [signAndSubmit, walletInfo?.address]
  )

  const defaultWithdrawShares = useCallback(
    async (shares: number) => {
      const address = walletInfo?.address
      if (!address) throw new Error('Connect a wallet to withdraw')

      const build = await fetch('/api/defindex/withdraw-shares', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller: address,
          shares,
          slippageBps: 100,
        }),
      })

      if (!build.ok) {
        throw new Error(await readErrorMessage(build))
      }

      const { xdr } = (await build.json()) as { xdr: string }
      if (!xdr) throw new Error('No withdraw transaction returned from server')

      return signAndSubmit(xdr, address)
    },
    [signAndSubmit, walletInfo?.address]
  )

  const refreshBalanceRef = useRef(refreshBalance)
  refreshBalanceRef.current = refreshBalance

  const refreshBalances = useCallback(async () => {
    const address = walletInfo?.address
    if (!address) {
      setVaultBalance(0)
      setDfTokens(0)
      setVaultMeta(null)
      setVaultInfoError(null)
      setBalanceError(null)
      return { vaultBalance: 0, walletBalance: 0 }
    }

    await refreshBalanceRef.current()
    const [, vaultAmt] = await Promise.all([fetchVaultMeta(), getVaultBalance(address)])

    return {
      walletBalance,
      vaultBalance: normalizeUSDC(vaultAmt),
    }
  }, [fetchVaultMeta, getVaultBalance, walletInfo?.address])

  /** Load Defindex data when the Stellar account changes — not when `refreshBalance` identity changes. */
  useEffect(() => {
    const address = walletInfo?.address
    if (!address) {
      setVaultBalance(0)
      setDfTokens(0)
      setVaultMeta(null)
      setVaultInfoError(null)
      setBalanceError(null)
      return
    }

    let cancelled = false

    const load = async () => {
      await refreshBalanceRef.current()
      if (cancelled) return
      await Promise.all([fetchVaultMeta(), getVaultBalance(address)])
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [walletInfo?.address, fetchVaultMeta, getVaultBalance])

  const depositToVault = useMemo(
    () =>
      async (...args: unknown[]) => {
        if (options?.depositToVaultAction) {
          const result = await options.depositToVaultAction(...args)
          await refreshBalances()
          return result
        }
        const amounts = args[0]
        if (!Array.isArray(amounts) || !amounts.every((a) => typeof a === 'number')) {
          throw new Error('depositToVault requires a number[] of raw per-asset amounts')
        }
        const result = await defaultDeposit(amounts)
        await refreshBalances()
        return result
      },
    [defaultDeposit, options?.depositToVaultAction, refreshBalances]
  )

  const withdrawFromVault = useMemo(
    () =>
      async (...args: unknown[]) => {
        if (options?.withdrawFromVaultAction) {
          const result = await options.withdrawFromVaultAction(...args)
          await refreshBalances()
          return result
        }
        const amounts = args[0]
        if (!Array.isArray(amounts) || !amounts.every((a) => typeof a === 'number')) {
          throw new Error('withdrawFromVault requires a number[] of raw per-asset amounts')
        }
        const result = await defaultWithdraw(amounts)
        await refreshBalances()
        return result
      },
    [defaultWithdraw, options?.withdrawFromVaultAction, refreshBalances]
  )

  const withdrawVaultShares = useMemo(
    () =>
      async (shares: number) => {
        const result = await defaultWithdrawShares(shares)
        await refreshBalances()
        return result
      },
    [defaultWithdrawShares, refreshBalances]
  )

  return {
    depositToVault,
    withdrawFromVault,
    withdrawVaultShares,
    getVaultBalance,
    refreshBalances,
    vaultMeta,
    dfTokens,
    vaultBalance: normalizeUSDC(vaultBalance),
    walletBalance,
    availableCapital: normalizeUSDC(
      getAvailableCapital({
        wallet: walletBalance,
        reserved: 0,
        stake: 0,
      })
    ),
    isLoadingBalances,
    balanceError,
    vaultInfoError,
  }
}
