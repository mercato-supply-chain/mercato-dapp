'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { normalizeUSDC } from '@/lib/format'
import { getAvailableCapital } from '@/lib/capital'
import { useWallet } from '@/hooks/use-wallet'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { PollarWalletKitLimitations } from '@/lib/mercato-wallet'
import type { SendTransactionResponse } from '@defindex/sdk'
import { readErrorMessage, invalidateVaultDataCache } from '@/lib/defindex/vault-cache'
import { useVaultMeta } from '@/hooks/use-vault-meta'
import { useVaultBalance } from '@/hooks/use-vault-balance'

type VaultAction<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  ...args: TArgs
) => Promise<TResult>

interface UseDefindexOptions {
  depositToVaultAction?: VaultAction
  withdrawFromVaultAction?: VaultAction
}

export type { MercatoVaultMeta } from '@/hooks/use-vault-meta'

export const useDefindex = (options?: UseDefindexOptions) => {
  const { walletInfo, refreshBalance, canSignTransactions } = useWallet()
  const {
    vaultMeta,
    vaultInfoError,
    vaultMetaRef,
    fetchVaultMetaRef,
    setVaultMeta,
    setVaultInfoError,
  } = useVaultMeta()
  const {
    walletBalance,
    walletRawBalance,
    vaultBalance,
    vaultRawBalance,
    dfTokens,
    isLoadingBalances,
    balanceError,
    setWalletBalance,
    setWalletRawBalance,
    setVaultBalance,
    setVaultRawBalance,
    setDfTokens,
    setBalanceError,
    getVaultBalance,
    loadUserBalancesRef,
  } = useVaultBalance()

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
