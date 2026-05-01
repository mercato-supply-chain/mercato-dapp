'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeUSDC } from '@/lib/format'
import { getAvailableCapital } from '@/lib/capital'
import { useWallet } from '@/hooks/use-wallet'

type VaultAction<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  ...args: TArgs
) => Promise<TResult>

interface UseDefindexOptions {
  depositToVaultAction?: VaultAction
  withdrawFromVaultAction?: VaultAction
}

type DefindexBalanceResponse = {
  underlyingBalance?: number | string
  underlying_balance?: number | string
  dfTokens?: number | string
  df_tokens?: number | string
}

const DEFINDEX_API_URL =
  process.env.NEXT_PUBLIC_DEFINDEX_API_URL ?? 'https://api.defindex.io'
const DEFINDEX_VAULT_ADDRESS = process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS ?? ''
const DEFINDEX_API_KEY = process.env.NEXT_PUBLIC_DEFINDEX_API_KEY ?? ''

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export const useDefindex = (options?: UseDefindexOptions) => {
  const { walletInfo, balance: walletBalance, refreshBalance } = useWallet()
  const [vaultBalance, setVaultBalance] = useState(0)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  const getVaultBalance = useCallback(async (address: string): Promise<number> => {
    if (!address || !DEFINDEX_VAULT_ADDRESS || !DEFINDEX_API_KEY) {
      setVaultBalance(0)
      return 0
    }

    try {
      setIsLoadingBalances(true)
      setBalanceError(null)

      const url = new URL(
        `${DEFINDEX_API_URL}/vault/${DEFINDEX_VAULT_ADDRESS}/balance`
      )
      url.searchParams.set('caller', address)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${DEFINDEX_API_KEY}`,
        },
      })

      if (!response.ok) {
        throw new Error(`DeFindex balance request failed (${response.status})`)
      }

      const payload = (await response.json()) as DefindexBalanceResponse
      const rawAmount =
        payload.underlyingBalance ??
        payload.underlying_balance ??
        payload.dfTokens ??
        payload.df_tokens ??
        0

      const normalized = normalizeUSDC(parseAmount(rawAmount))
      setVaultBalance(normalized)
      return normalized
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load DeFindex vault balance'
      setBalanceError(message)
      setVaultBalance(0)
      return 0
    } finally {
      setIsLoadingBalances(false)
    }
  }, [])

  const refreshBalances = useCallback(async () => {
    const address = walletInfo?.address
    if (!address) {
      setVaultBalance(0)
      return { vaultBalance: 0, walletBalance: 0 }
    }

    const [nextWalletBalance, nextVaultBalance] = await Promise.all([
      refreshBalance(),
      getVaultBalance(address),
    ])

    return {
      walletBalance: normalizeUSDC(nextWalletBalance),
      vaultBalance: normalizeUSDC(nextVaultBalance),
    }
  }, [getVaultBalance, refreshBalance, walletInfo?.address])

  useEffect(() => {
    void refreshBalances()
  }, [refreshBalances])

  const depositToVault = useMemo(
    () =>
      async (...args: unknown[]) => {
        if (!options?.depositToVaultAction) {
          throw new Error('depositToVault action is not configured')
        }
        const result = await options.depositToVaultAction(...args)
        await refreshBalances()
        return result
      },
    [options?.depositToVaultAction, refreshBalances]
  )

  const withdrawFromVault = useMemo(
    () =>
      async (...args: unknown[]) => {
        if (!options?.withdrawFromVaultAction) {
          throw new Error('withdrawFromVault action is not configured')
        }
        const result = await options.withdrawFromVaultAction(...args)
        await refreshBalances()
        return result
      },
    [options?.withdrawFromVaultAction, refreshBalances]
  )

  return {
    depositToVault,
    withdrawFromVault,
    getVaultBalance,
    refreshBalances,
    vaultBalance: normalizeUSDC(vaultBalance),
    walletBalance: normalizeUSDC(walletBalance),
    availableCapital: normalizeUSDC(
      getAvailableCapital({
        wallet: walletBalance,
        reserved: 0, // TODO(#4): connect when Capital State Model is implemented
        stake: 0,    // TODO: connect from useStake() hook when available
      })
    ),
    isLoadingBalances,
    balanceError,
  }
}

