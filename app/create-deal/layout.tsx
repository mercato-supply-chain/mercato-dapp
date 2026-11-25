import type { ReactNode } from 'react'
import { WalletAppProviders } from '@/components/providers/wallet-app-providers'

export default function CreateDealLayout({ children }: { children: ReactNode }) {
  return <WalletAppProviders>{children}</WalletAppProviders>
}
