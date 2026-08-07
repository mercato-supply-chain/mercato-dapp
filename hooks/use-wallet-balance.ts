'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TxHistoryState } from '@pollar/core'
import { usePollarSession } from '@/providers/pollar-provider'
import {
  fetchHorizonBalances,
  normalizePollarWalletBalance,
  type ConnectedWallet,
  type WalletBalanceSummary,
} from '@/lib/mercato-wallet'

export function useWalletBalance(wallet: ConnectedWallet | null) {
  const pollar = usePollarSession()
  const refreshWalletBalance = pollar.refreshWalletBalance
  const [balances, setBalances] = useState<WalletBalanceSummary | null>(null)
  const [txHistory, setTxHistory] = useState<TxHistoryState | null>(null)

  useEffect(() => {
    if (wallet?.provider !== 'pollar') return

    setTxHistory(pollar.txHistory)

    if (pollar.walletBalance.step === 'idle') {
      void pollar.refreshWalletBalance()
      return
    }

    if (pollar.walletBalance.step === 'loaded') {
      setBalances(normalizePollarWalletBalance(pollar.walletBalance))
    }
  }, [wallet?.provider, pollar.txHistory, pollar.walletBalance, pollar.refreshWalletBalance])

  useEffect(() => {
    if (!wallet || wallet.provider !== 'stellar-wallets-kit') return
    let cancelled = false

    const refresh = async () => {
      try {
        const nextBalances = await fetchHorizonBalances(wallet.publicKey)
        if (!cancelled) setBalances(nextBalances)
      } catch (error) {
        if (!cancelled) {
          console.error('[wallet-balance] failed to load wallet balances', error)
        }
      }
    }

    void refresh()
    return () => {
      cancelled = true
    }
  }, [wallet?.publicKey, wallet?.provider])

  const refreshBalance = useCallback(async () => {
    if (!wallet) return

    if (wallet.provider === 'pollar') {
      await refreshWalletBalance()
      return
    }

    try {
      const nextBalances = await fetchHorizonBalances(wallet.publicKey)
      setBalances(nextBalances)
    } catch (error) {
      console.error('[wallet-balance] failed to refresh wallet balances', error)
    }
  }, [refreshWalletBalance, wallet])

  const clearBalances = useCallback(() => {
    setBalances(null)
    setTxHistory(null)
  }, [])

  return { balances, txHistory, refreshBalance, clearBalances }
}
