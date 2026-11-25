'use client'

import type { ReactNode } from 'react'
import { PollarProvider } from '@/providers/pollar-provider'
import { WalletProvider } from '@/providers/wallet-provider'

/**
 * Lightweight wallet boundary for `/auth/login` and `/auth/sign-up` routes that
 * support Pollar or Stellar wallet sign-in without importing notifications or
 * Trustless Work escrow bundles.
 */
export function AuthWalletProviders({ children }: { children: ReactNode }) {
  return (
    <PollarProvider>
      <WalletProvider>{children}</WalletProvider>
    </PollarProvider>
  )
}
