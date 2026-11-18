'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { TxHistoryState } from '@pollar/core'
import { signOutApp } from '@/lib/auth/sign-out-app'
import { usePollarSession } from '@/providers/pollar-provider'
import { getStellarWalletKitSync } from '@/lib/trustless/lazy-wallet-kit'
import { useWalletPersistence } from '@/hooks/use-wallet-persistence'
import { useWalletBalance } from '@/hooks/use-wallet-balance'
import { usePollarWallet } from '@/hooks/use-pollar-wallet'
import { useExternalWallet } from '@/hooks/use-external-wallet'
import {
  getWalletAdapterLabel,
  truncatePublicKey,
  type ConnectedWallet,
  type WalletBalanceSummary,
  type WalletProviderType,
  type WalletStatus,
} from '@/lib/mercato-wallet'

interface WalletContextValue {
  provider: WalletProviderType | null
  publicKey: string | null
  walletId: string | null
  status: WalletStatus | null
  isConnected: boolean
  isEmbedded: boolean
  walletName: string | null
  wallet: ConnectedWallet | null
  walletInfo: { address: string; walletName: string } | null
  truncatedAddress: string | null
  balances: WalletBalanceSummary | null
  txHistory: TxHistoryState | null
  canSignTransactions: boolean
  connectExternalWallet: () => Promise<void>
  connectPollarWallet: () => Promise<void>
  disconnect: () => Promise<void>
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider')
  }
  return context
}

function toWalletInfo(wallet: ConnectedWallet | null) {
  if (!wallet) return null
  return {
    address: wallet.publicKey,
    walletName: getWalletAdapterLabel(wallet.walletName),
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const pollar = usePollarSession()
  const { wallet, persistWallet } = useWalletPersistence()
  const { balances, txHistory, refreshBalance, clearBalances } = useWalletBalance(wallet)
  const { connectPollarWallet, clearPollarSyncRefs } = usePollarWallet()
  const { connectExternalWallet } = useExternalWallet(persistWallet)

  const disconnect = useCallback(async () => {
    try {
      // The wallet kit is only disconnected if it was already initialized.
      // Otherwise, there's nothing to disconnect.
      const walletKit = getStellarWalletKitSync()
      if (walletKit) {
        await walletKit.disconnect()
      }
    } catch {
      // ignore wallet-kit disconnect failures
    }

    try {
      await pollar.logout()
    } catch {
      // ignore embedded wallet logout failures
    }

    if (wallet?.provider === 'pollar') {
      try {
        await signOutApp()
      } catch {
        // ignore sign-out failures
      }
    }

    clearPollarSyncRefs()
    persistWallet(null)
    clearBalances()
  }, [clearBalances, clearPollarSyncRefs, persistWallet, pollar, wallet?.provider])

  const value = useMemo<WalletContextValue>(
    () => ({
      provider: wallet?.provider ?? null,
      publicKey: wallet?.publicKey ?? null,
      walletId: wallet?.walletId ?? null,
      status: wallet?.status ?? null,
      isConnected: wallet !== null,
      isEmbedded: wallet?.isEmbedded ?? false,
      walletName: wallet?.walletName ?? null,
      wallet,
      walletInfo: toWalletInfo(wallet),
      truncatedAddress: truncatePublicKey(wallet?.publicKey),
      balances,
      txHistory: txHistory ?? null,
      canSignTransactions: wallet !== null,
      connectExternalWallet,
      connectPollarWallet,
      disconnect,
      refreshBalance,
    }),
    [
      balances,
      connectExternalWallet,
      connectPollarWallet,
      disconnect,
      refreshBalance,
      txHistory,
      wallet,
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
