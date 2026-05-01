'use client'

import { useMercatoWallet } from '@/hooks/use-mercato-wallet'

export const useWallet = () => {
  const mercatoWallet = useMercatoWallet()

  const handleConnect = async () => {
    try {
      await mercatoWallet.connectExternalWallet()
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await mercatoWallet.disconnect()
    } catch (error) {
      console.error('Error disconnecting wallet:', error)
    }
  }

  return {
    walletInfo: mercatoWallet.walletInfo,
    isConnected: mercatoWallet.isConnected,
    truncatedAddress: mercatoWallet.truncatedAddress,
    provider: mercatoWallet.provider,
    publicKey: mercatoWallet.publicKey,
    walletId: mercatoWallet.walletId,
    status: mercatoWallet.status,
    isEmbedded: mercatoWallet.isEmbedded,
    balances: mercatoWallet.balances,
    txHistory: mercatoWallet.txHistory,
    canSignTransactions: mercatoWallet.canSignTransactions,
    connectExternalWallet: mercatoWallet.connectExternalWallet,
    connectPollarWallet: mercatoWallet.connectPollarWallet,
    handleConnect,
    handleDisconnect,
    disconnectWallet: mercatoWallet.disconnect,
    refreshBalance: mercatoWallet.refreshBalance,
  }
}
