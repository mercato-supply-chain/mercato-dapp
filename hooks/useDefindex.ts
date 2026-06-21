'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeUSDC } from '@/lib/format'
import { getAvailableCapital } from '@/lib/capital'
import { useWallet } from '@/hooks/use-wallet'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { PollarWalletKitLimitations } from '@/lib/mercato-wallet'
import type { SendTransactionResponse } from '@defindex/sdk'
import {
  readErrorMessage,
  hasClientVaultConfigured,
  vaultMetaRequest,
  vaultBalanceRequest,
  sacBalanceRequest,
  invalidateVaultDataCache,
  isRateLimitMessage,
} from '@/lib/defindex/vault-cache'

type VaultAction<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  ...args: TArgs
) => Promise<TResult>

interface UseDefindexOptions {
  depositToVaultAction?: VaultAction
  withdrawFromVaultAction?: VaultAction
}

import type { VaultMonitorAssetRow } from '@/lib/defindex/vault-monitor'

export type MercatoVaultMeta = {
  vaultAddress: string
  network: string
  name: string
  symbol: string
  apy: number
  feesBps: { vaultFee: number; defindexFee: number }
  assets?: Array<{ address: string; name?: string; symbol?: string; strategies?: unknown[] }>
  totals?: {
    tvlDisplay: number
    idleDisplay: number
    investedDisplay: number
    idlePercent: number
  }
  assetRows?: VaultMonitorAssetRow[]
  explorerContractUrl?: string
}

export const useDefindex = (options?: UseDefindexOptions) => {
  const { walletInfo, refreshBalance, canSignTransactions } = useWallet()
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletRawBalance, setWalletRawBalance] = useState(0)
  const [vaultBalance, setVaultBalance] = useState(0)
  const [vaultRawBalance, setVaultRawBalance] = useState(0)
  const [dfTokens, setDfTokens] = useState(0)
  const [vaultMeta, setVaultMeta] = useState<MercatoVaultMeta | null>(null)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [vaultInfoError, setVaultInfoError] = useState<string | null>(null)
  const vaultMetaRef = useRef<MercatoVaultMeta | null>(null)
  vaultMetaRef.current = vaultMeta
  const walletBalanceRef = useRef(0)
  walletBalanceRef.current = walletBalance
  const walletRawBalanceRef = useRef(0)
  walletRawBalanceRef.current = walletRawBalance
  const vaultBalanceRef = useRef(0)
  vaultBalanceRef.current = vaultBalance
  const vaultRawBalanceRef = useRef(0)
  vaultRawBalanceRef.current = vaultRawBalance

  const fetchVaultMeta = useCallback(async (): Promise<MercatoVaultMeta | null> => {
    if (!hasClientVaultConfigured()) {
      setVaultInfoError(null)
      setVaultMeta(null)
      return null
    }
    try {
      const data = await vaultMetaRequest.fetch()
      setVaultInfoError(null)
      setVaultMeta(data)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load vault metadata.'
      if (!isRateLimitMessage(message) || !vaultMetaRef.current) {
        setVaultInfoError(message)
      }
      return vaultMetaRef.current
    }
  }, [])

  const getVaultAssetBalance = useCallback(
    async (address: string, assetContract: string | undefined): Promise<number> => {
      if (!address || !assetContract) {
        setWalletBalance(0)
        setWalletRawBalance(0)
        return 0
      }

      try {
        const payload = await sacBalanceRequest.fetch(address, assetContract)
        const normalized = normalizeUSDC(payload.displayBalance ?? 0)
        const raw =
          typeof payload.rawBalance === 'string' && payload.rawBalance
            ? Number(payload.rawBalance)
            : 0
        setWalletBalance(normalized)
        setWalletRawBalance(Number.isFinite(raw) ? raw : 0)
        return normalized
      } catch {
        if (walletRawBalanceRef.current > 0) {
          return walletBalanceRef.current
        }
        setWalletBalance(0)
        setWalletRawBalance(0)
        return 0
      }
    },
    [],
  )

  const getVaultBalance = useCallback(async (address: string): Promise<number> => {
    if (!address) {
      setVaultBalance(0)
      setVaultRawBalance(0)
      setDfTokens(0)
      return 0
    }

    if (!hasClientVaultConfigured()) {
      setBalanceError(null)
      setVaultBalance(0)
      setVaultRawBalance(0)
      setDfTokens(0)
      return 0
    }

    try {
      setBalanceError(null)
      const payload = await vaultBalanceRequest.fetch(address)
      const normalized = normalizeUSDC(payload.underlyingTotal ?? 0)
      const rawTotal =
        typeof payload.underlyingTotalRaw === 'number' && Number.isFinite(payload.underlyingTotalRaw)
          ? payload.underlyingTotalRaw
          : 0
      setVaultBalance(normalized)
      setVaultRawBalance(rawTotal)
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
      if (!isRateLimitMessage(message)) {
        setBalanceError(message)
        setVaultBalance(0)
        setVaultRawBalance(0)
        setDfTokens(0)
        return 0
      }
      return vaultBalanceRef.current
    }
  }, [])

  const loadUserBalances = useCallback(
    async (address: string, assetContract?: string) => {
      setIsLoadingBalances(true)
      try {
        const [vaultAmt, walletAmt] = await Promise.all([
          getVaultBalance(address),
          getVaultAssetBalance(address, assetContract),
        ])
        return {
          vaultBalance: normalizeUSDC(vaultAmt),
          walletBalance: normalizeUSDC(walletAmt),
        }
      } finally {
        setIsLoadingBalances(false)
      }
    },
    [getVaultAssetBalance, getVaultBalance],
  )

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

  const fetchVaultMetaRef = useRef(fetchVaultMeta)
  fetchVaultMetaRef.current = fetchVaultMeta

  const loadUserBalancesRef = useRef(loadUserBalances)
  loadUserBalancesRef.current = loadUserBalances

  const refreshBalances = useCallback(async () => {
    const address = walletInfo?.address
    if (!address) {
      setVaultBalance(0)
      setVaultRawBalance(0)
      setDfTokens(0)
      setVaultMeta(null)
      setVaultInfoError(null)
      setBalanceError(null)
      setWalletBalance(0)
      setWalletRawBalance(0)
      return { vaultBalance: 0, walletBalance: 0 }
    }

    await refreshBalanceRef.current()
    const meta = vaultMetaRef.current?.assets?.[0]?.address
      ? vaultMetaRef.current
      : await fetchVaultMetaRef.current()
    invalidateVaultDataCache(address, meta?.assets?.[0]?.address)
    return loadUserBalancesRef.current(address, meta?.assets?.[0]?.address)
  }, [walletInfo?.address])

  /** Load vault metadata on mount (no wallet required). */
  useEffect(() => {
    if (!hasClientVaultConfigured()) return
    void fetchVaultMetaRef.current()
  }, [])

  /** Load user balance when the Stellar account changes. */
  useEffect(() => {
    const address = walletInfo?.address
    if (!address) {
      setVaultBalance(0)
      setVaultRawBalance(0)
      setDfTokens(0)
      setBalanceError(null)
      setWalletBalance(0)
      setWalletRawBalance(0)
      return
    }

    let cancelled = false

    const load = async () => {
      const meta = vaultMetaRef.current?.assets?.[0]?.address
        ? vaultMetaRef.current
        : await fetchVaultMetaRef.current()
      if (cancelled) return
      await loadUserBalancesRef.current(address, meta?.assets?.[0]?.address)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [walletInfo?.address])

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
        invalidateVaultDataCache(
          walletInfo?.address ?? '',
          vaultMetaRef.current?.assets?.[0]?.address,
        )
        await refreshBalances()
        return result
      },
    [defaultDeposit, options?.depositToVaultAction, refreshBalances, walletInfo?.address]
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
        invalidateVaultDataCache(
          walletInfo?.address ?? '',
          vaultMetaRef.current?.assets?.[0]?.address,
        )
        await refreshBalances()
        return result
      },
    [defaultWithdraw, options?.withdrawFromVaultAction, refreshBalances, walletInfo?.address]
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
    vaultRawBalance,
    walletBalance,
    walletRawBalance,
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
