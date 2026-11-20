'use client'

import { useCallback, useRef, useState } from 'react'
import { normalizeUSDC } from '@/lib/format'
import { getClientVaultContractId } from '@/lib/defindex/client-config'
import {
  hasClientVaultConfigured,
  vaultBalanceRequest,
  sacBalanceRequest,
  isRateLimitMessage,
} from '@/lib/defindex/vault-cache'

type WalletBalanceCache = { identity: string; balance: number; rawBalance: number }
type VaultBalanceCache = {
  identity: string
  balance: number
  rawBalance: number
  dfTokens: number
}

function makeBalanceIdentity(address: string, assetContract?: string): string {
  return JSON.stringify([
    address.trim(),
    assetContract?.trim() ?? '',
    getClientVaultContractId(),
    process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK?.trim() || 'testnet',
  ])
}

export function useVaultBalance() {
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletRawBalance, setWalletRawBalance] = useState(0)
  const [vaultBalance, setVaultBalance] = useState(0)
  const [vaultRawBalance, setVaultRawBalance] = useState(0)
  const [dfTokens, setDfTokens] = useState(0)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  // Every batch owns a generation. Only the latest generation may commit data,
  // errors, or loading state; invalidation also covers a wallet disconnect.
  const requestGeneration = useRef(0)
  const activeIdentity = useRef<string | null>(null)
  const activeAddress = useRef('')
  const activeAsset = useRef<string | undefined>(undefined)
  const walletCache = useRef<WalletBalanceCache | null>(null)
  const vaultCache = useRef<VaultBalanceCache | null>(null)

  const clearBalances = useCallback(() => {
    walletCache.current = null
    vaultCache.current = null
    setWalletBalance(0)
    setWalletRawBalance(0)
    setVaultBalance(0)
    setVaultRawBalance(0)
    setDfTokens(0)
    setBalanceError(null)
  }, [])

  const invalidateBalanceRequests = useCallback(() => {
    requestGeneration.current += 1
    setIsLoadingBalances(false)
  }, [])

  const resetBalances = useCallback(() => {
    invalidateBalanceRequests()
    activeIdentity.current = null
    activeAddress.current = ''
    activeAsset.current = undefined
    clearBalances()
  }, [clearBalances, invalidateBalanceRequests])

  const prepareIdentity = useCallback((address: string, assetContract?: string) => {
    const identity = makeBalanceIdentity(address, assetContract)
    if (activeIdentity.current !== identity) {
      clearBalances()
      activeIdentity.current = identity
    }
    activeAddress.current = address
    activeAsset.current = assetContract
    return identity
  }, [clearBalances])

  const fetchWalletBalance = useCallback(
    async (address: string, assetContract: string | undefined, identity: string, generation: number): Promise<number> => {
      if (!address || !assetContract) {
        if (generation === requestGeneration.current && activeIdentity.current === identity) {
          walletCache.current = { identity, balance: 0, rawBalance: 0 }
          setWalletBalance(0)
          setWalletRawBalance(0)
        }
        return 0
      }

      try {
        const payload = await sacBalanceRequest.fetch(address, assetContract)
        const normalized = normalizeUSDC(payload.displayBalance ?? 0)
        const parsedRaw =
          typeof payload.rawBalance === 'string' && payload.rawBalance
            ? Number(payload.rawBalance)
            : 0
        const raw = Number.isFinite(parsedRaw) ? parsedRaw : 0

        if (generation === requestGeneration.current && activeIdentity.current === identity) {
          walletCache.current = { identity, balance: normalized, rawBalance: raw }
          setWalletBalance(normalized)
          setWalletRawBalance(raw)
        }
        return normalized
      } catch {
        const cached = walletCache.current
        if (cached?.identity === identity && cached.rawBalance > 0) return cached.balance

        if (generation === requestGeneration.current && activeIdentity.current === identity) {
          walletCache.current = { identity, balance: 0, rawBalance: 0 }
          setWalletBalance(0)
          setWalletRawBalance(0)
        }
        return 0
      }
    },
    [],
  )

  const fetchVaultBalance = useCallback(
    async (address: string, identity: string, generation: number): Promise<number> => {
      if (!address) {
        if (generation === requestGeneration.current && activeIdentity.current === identity) {
          vaultCache.current = { identity, balance: 0, rawBalance: 0, dfTokens: 0 }
          setVaultBalance(0)
          setVaultRawBalance(0)
          setDfTokens(0)
        }
        return 0
      }

      if (!hasClientVaultConfigured()) {
        if (generation === requestGeneration.current && activeIdentity.current === identity) {
          setBalanceError(null)
          vaultCache.current = { identity, balance: 0, rawBalance: 0, dfTokens: 0 }
          setVaultBalance(0)
          setVaultRawBalance(0)
          setDfTokens(0)
        }
        return 0
      }

      try {
        const payload = await vaultBalanceRequest.fetch(address)
        const normalized = normalizeUSDC(payload.underlyingTotal ?? 0)
        const rawTotal =
          typeof payload.underlyingTotalRaw === 'number' && Number.isFinite(payload.underlyingTotalRaw)
            ? payload.underlyingTotalRaw
            : 0
        const tokens =
          typeof payload.dfTokens === 'number' && Number.isFinite(payload.dfTokens)
            ? payload.dfTokens
            : 0

        if (generation === requestGeneration.current && activeIdentity.current === identity) {
          vaultCache.current = { identity, balance: normalized, rawBalance: rawTotal, dfTokens: tokens }
          setBalanceError(null)
          setVaultBalance(normalized)
          setVaultRawBalance(rawTotal)
          setDfTokens(tokens)
        }
        return normalized
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load Mercato vault balance'
        const cached = vaultCache.current

        if (isRateLimitMessage(message)) {
          return cached?.identity === identity ? cached.balance : 0
        }

        if (generation === requestGeneration.current && activeIdentity.current === identity) {
          vaultCache.current = { identity, balance: 0, rawBalance: 0, dfTokens: 0 }
          setBalanceError(message)
          setVaultBalance(0)
          setVaultRawBalance(0)
          setDfTokens(0)
        }
        return 0
      }
    },
    [],
  )

  const getVaultBalance = useCallback(async (address: string): Promise<number> => {
    const identity = prepareIdentity(address, activeAddress.current === address ? activeAsset.current : undefined)
    const generation = ++requestGeneration.current
    setIsLoadingBalances(true)
    setBalanceError(null)
    try {
      return await fetchVaultBalance(address, identity, generation)
    } finally {
      if (generation === requestGeneration.current) setIsLoadingBalances(false)
    }
  }, [fetchVaultBalance, prepareIdentity])

  const loadUserBalances = useCallback(
    async (address: string, assetContract?: string) => {
      const identity = prepareIdentity(address, assetContract)
      const generation = ++requestGeneration.current
      setIsLoadingBalances(true)
      setBalanceError(null)
      try {
        const [vaultAmt, walletAmt] = await Promise.all([
          fetchVaultBalance(address, identity, generation),
          fetchWalletBalance(address, assetContract, identity, generation),
        ])
        return {
          vaultBalance: normalizeUSDC(vaultAmt),
          walletBalance: normalizeUSDC(walletAmt),
        }
      } finally {
        if (generation === requestGeneration.current) setIsLoadingBalances(false)
      }
    },
    [fetchVaultBalance, fetchWalletBalance, prepareIdentity],
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
    getVaultBalance,
    loadUserBalancesRef,
    invalidateBalanceRequests,
    resetBalances,
  }
}
