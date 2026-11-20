'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TxHistoryState } from '@pollar/core'
import { usePollarSession } from '@/providers/pollar-provider'
import {
  fetchHorizonBalances,
  getStellarNetwork,
  normalizePollarWalletBalance,
  type ConnectedWallet,
  type WalletBalanceSummary,
} from '@/lib/mercato-wallet'

function getWalletKey(wallet: ConnectedWallet | null): string | null {
  if (!wallet || !wallet.publicKey) return null
  return `${wallet.provider}:${wallet.publicKey}:${getStellarNetwork()}`
}

export function useWalletBalance(wallet: ConnectedWallet | null) {
  const pollar = usePollarSession()
  const { refreshWalletBalance, txHistory: pollarTxHistory, walletBalance: pollarWalletBalance } = pollar
  const [balances, setBalances] = useState<WalletBalanceSummary | null>(null)
  const [txHistory, setTxHistory] = useState<TxHistoryState | null>(null)

  const activeWalletRef = useRef<ConnectedWallet | null>(wallet)
  const generationRef = useRef<number>(0)
  const prevWalletKeyRef = useRef<string | null>(getWalletKey(wallet))

  const walletKey = getWalletKey(wallet)
  const provider = wallet?.provider
  const publicKey = wallet?.publicKey

  useEffect(() => {
    activeWalletRef.current = wallet
  }, [wallet])

  // Invalidate any in-flight loads and reset state when the connected wallet identity changes or disconnects
  useEffect(() => {
    if (prevWalletKeyRef.current !== walletKey) {
      prevWalletKeyRef.current = walletKey
      generationRef.current += 1
      setBalances(null)
      setTxHistory(null)
    }
  }, [walletKey])

  useEffect(() => {
    if (provider !== 'pollar' || !walletKey) return
    const currentGen = generationRef.current

    if (getWalletKey(activeWalletRef.current) !== walletKey || generationRef.current !== currentGen) {
      return
    }

    setTxHistory(pollarTxHistory)

    if (pollarWalletBalance.step === 'idle') {
      void refreshWalletBalance()
      return
    }

    if (pollarWalletBalance.step === 'loaded') {
      if (getWalletKey(activeWalletRef.current) === walletKey && generationRef.current === currentGen) {
        setBalances(normalizePollarWalletBalance(pollarWalletBalance))
      }
    }

    if (pollarWalletBalance.step === 'error') {
      if (getWalletKey(activeWalletRef.current) === walletKey && generationRef.current === currentGen) {
        console.error('[wallet-balance] embedded wallet balance fetch error:', pollarWalletBalance.message)
      }
    }
  }, [walletKey, provider, pollarTxHistory, pollarWalletBalance, refreshWalletBalance])

  useEffect(() => {
    if (provider !== 'stellar-wallets-kit' || !publicKey || !walletKey) return
    const currentGen = generationRef.current
    let cancelled = false

    const refresh = async () => {
      try {
        const nextBalances = await fetchHorizonBalances(publicKey)
        if (!cancelled && generationRef.current === currentGen && getWalletKey(activeWalletRef.current) === walletKey) {
          setBalances(nextBalances)
        }
      } catch (error) {
        if (!cancelled && generationRef.current === currentGen && getWalletKey(activeWalletRef.current) === walletKey) {
          console.error('[wallet-balance] failed to load wallet balances', error)
        }
      }
    }

    void refresh()
    return () => {
      cancelled = true
    }
  }, [walletKey, provider, publicKey])

  const refreshBalance = useCallback(async () => {
    if (!wallet) return

    generationRef.current += 1
    const targetKey = getWalletKey(wallet)
    const targetGen = generationRef.current

    if (wallet.provider === 'pollar') {
      await refreshWalletBalance()
      return
    }

    try {
      const nextBalances = await fetchHorizonBalances(wallet.publicKey)
      if (generationRef.current === targetGen && getWalletKey(activeWalletRef.current) === targetKey) {
        setBalances(nextBalances)
      }
    } catch (error) {
      if (generationRef.current === targetGen && getWalletKey(activeWalletRef.current) === targetKey) {
        console.error('[wallet-balance] failed to refresh wallet balances', error)
      }
    }
  }, [refreshWalletBalance, wallet])

  const clearBalances = useCallback(() => {
    generationRef.current += 1
    setBalances(null)
    setTxHistory(null)
  }, [])

  return { balances, txHistory, refreshBalance, clearBalances }
}

