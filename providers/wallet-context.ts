'use client'

import { createContext, useContext } from 'react'
import type { TxHistoryState } from '@pollar/core'
import type {
  ConnectedWallet,
  WalletBalanceSummary,
  WalletProviderType,
  WalletStatus,
} from '@/lib/mercato-wallet'

export interface WalletContextValue {
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

export const WalletContext = createContext<WalletContextValue | null>(null)

export function useOptionalWalletContext(): WalletContextValue | null {
  return useContext(WalletContext)
}

export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider')
  }
  return context
}
