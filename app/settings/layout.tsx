import type { ReactNode } from 'react'
import { WalletAppProviders } from '@/components/providers/wallet-app-providers'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <WalletAppProviders>{children}</WalletAppProviders>
}
