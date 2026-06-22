'use client'

import { useCallback, useRef, useState } from 'react'
import { normalizeUSDC } from '@/lib/format'
import {
  hasClientVaultConfigured,
  vaultBalanceRequest,
  sacBalanceRequest,
  isRateLimitMessage,
} from '@/lib/defindex/vault-cache'

export function useVaultBalance() {
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletRawBalance, setWalletRawBalance] = useState(0)
  const [vaultBalance, setVaultBalance] = useState(0)
  const [vaultRawBalance, setVaultRawBalance] = useState(0)
  const [dfTokens, setDfTokens] = useState(0)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const walletBalanceRef = useRef(0)
  walletBalanceRef.current = walletBalance
  const walletRawBalanceRef = useRef(0)
  walletRawBalanceRef.current = walletRawBalance
  const vaultBalanceRef = useRef(0)
  vaultBalanceRef.current = vaultBalance
  const vaultRawBalanceRef = useRef(0)
  vaultRawBalanceRef.current = vaultRawBalance

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

  const loadUserBalancesRef = useRef(loadUserBalances)
  loadUserBalancesRef.current = loadUserBalances

  return {
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
    walletBalanceRef,
    walletRawBalanceRef,
    vaultBalanceRef,
    vaultRawBalanceRef,
    getVaultBalance,
    loadUserBalancesRef,
  }
}
