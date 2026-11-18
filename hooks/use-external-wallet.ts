'use client'

import { useCallback } from 'react'
import { type ISupportedWallet } from '@creit.tech/stellar-wallets-kit'
import { getStellarWalletKit } from '@/lib/trustless/lazy-wallet-kit'
import type { ConnectedWallet } from '@/lib/mercato-wallet'

export function useExternalWallet(persistWallet: (w: ConnectedWallet | null) => void) {
  const connectExternalWallet = useCallback(async () => {
    const walletKit = await getStellarWalletKit()
    if (!walletKit) return

    await walletKit.openModal({
      modalTitle: 'Connect Your Stellar Wallet',
      onWalletSelected: async (option: ISupportedWallet) => {
        walletKit.setWallet(option.id)
        const { address } = await walletKit.getAddress()
        persistWallet({
          provider: 'stellar-wallets-kit',
          publicKey: address,
          isEmbedded: false,
          status: 'active',
          walletName: option.name,
        })
      },
    })
  }, [persistWallet])

  return { connectExternalWallet }
}
