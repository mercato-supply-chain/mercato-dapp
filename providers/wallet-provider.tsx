'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import { signOutApp } from '@/lib/auth/sign-out-app'
import { usePollarSession } from '@/providers/pollar-provider'
import {
  WalletContext,
  useOptionalWalletContext,
  useWalletContext,
  type WalletContextValue,
} from '@/providers/wallet-context'
import {
  getStellarWalletKitSync,
  resetStellarWalletKit,
} from '@/lib/trustless/lazy-wallet-kit'
import { useWalletPersistence } from '@/hooks/use-wallet-persistence'
import { useWalletBalance } from '@/hooks/use-wallet-balance'
import { usePollarWallet } from '@/hooks/use-pollar-wallet'
import { useExternalWallet } from '@/hooks/use-external-wallet'
import {
  DEFAULT_WALLET_CLEANUP_TIMEOUT_MS,
  runWithBoundedTimeout,
} from '@/lib/wallet/session-cleanup'
import {
  getWalletAdapterLabel,
  truncatePublicKey,
  type ConnectedWallet,
} from '@/lib/mercato-wallet'

export { useOptionalWalletContext, useWalletContext, type WalletContextValue }

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
    const wasPollar = wallet?.provider === 'pollar'

    // Clear local wallet state immediately so UI and storage never linger if remote calls stall.
    clearPollarSyncRefs()
    persistWallet(null)
    clearBalances()

    try {
      // The wallet kit is only disconnected if it was already initialized.
      // Otherwise, there's nothing to disconnect.
      const walletKit = getStellarWalletKitSync()
      if (walletKit) {
        resetStellarWalletKit()
        await runWithBoundedTimeout(
          Promise.resolve(walletKit.disconnect()),
          DEFAULT_WALLET_CLEANUP_TIMEOUT_MS,
        )
      }
    } catch {
      // ignore wallet-kit disconnect failures
    }

    try {
      await runWithBoundedTimeout(
        Promise.resolve(pollar.logout()),
        DEFAULT_WALLET_CLEANUP_TIMEOUT_MS,
      )
    } catch {
      // ignore embedded wallet logout failures
    }

    if (wasPollar) {
      try {
        await signOutApp()
      } catch {
        // ignore sign-out failures
      }
    }
  }, [clearBalances, clearPollarSyncRefs, persistWallet, pollar, wallet?.provider])

  const canSignTransactions =
    wallet !== null &&
    (wallet.provider !== 'pollar' ||
      (pollar.verified && pollar.wallet?.provisioning !== 'CREATING'))

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
      canSignTransactions,
      connectExternalWallet,
      connectPollarWallet,
      disconnect,
      refreshBalance,
    }),
    [
      balances,
      canSignTransactions,
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
