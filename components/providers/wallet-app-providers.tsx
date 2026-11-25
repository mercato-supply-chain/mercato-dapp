'use client'

import type { ReactNode } from 'react'
import { PollarProvider } from '@/providers/pollar-provider'
import { TrustlessWorkProvider } from '@/lib/trustless/config'
import { WalletProvider } from '@/providers/wallet-provider'
import { NotificationsProvider } from '@/components/notifications/notifications-provider'

/**
 * Transactional provider boundary mounted on dashboard, wallet, settings,
 * deal-funding, and deal-creation routes.
 */
export function WalletAppProviders({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <PollarProvider>
        <TrustlessWorkProvider>
          <WalletProvider>{children}</WalletProvider>
        </TrustlessWorkProvider>
      </PollarProvider>
    </NotificationsProvider>
  )
}
