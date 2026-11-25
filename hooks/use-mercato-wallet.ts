'use client'

import { useWalletContext } from '@/providers/wallet-context'

export function useMercatoWallet() {
  return useWalletContext()
}
