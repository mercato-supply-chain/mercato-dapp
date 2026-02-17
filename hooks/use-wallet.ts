'use client'

import { useWalletContext } from '@/providers/wallet-provider'
import { stellarWalletKit } from '@/lib/trustless/wallet-kit'
import type { ISupportedWallet } from '@creit.tech/stellar-wallets-kit'

export const useWallet = () => {
  const { setWalletInfo, clearWalletInfo, walletInfo, isConnected } =
    useWalletContext()

  const connectWallet = async () => {
    if (!stellarWalletKit) return
    await stellarWalletKit.openModal({
      modalTitle: 'Connect Your Stellar Wallet',
      onWalletSelected: async (option: ISupportedWallet) => {
        stellarWalletKit.setWallet(option.id)
        const { address } = await stellarWalletKit.getAddress()
        setWalletInfo(address, option.name)
      },
    })
  }

  const disconnectWallet = async () => {
    if (stellarWalletKit) await stellarWalletKit.disconnect()
    clearWalletInfo()
  }

  const handleConnect = async () => {
    try {
      await connectWallet()
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnectWallet()
    } catch (error) {
      console.error('Error disconnecting wallet:', error)
    }
  }

  const truncatedAddress = walletInfo?.address
    ? `${walletInfo.address.slice(0, 4)}…${walletInfo.address.slice(-4)}`
    : null

  return {
    walletInfo,
    isConnected,
    truncatedAddress,
    handleConnect,
    handleDisconnect,
  }
}
