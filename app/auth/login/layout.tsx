import type { ReactNode } from 'react'
import { AuthWalletProviders } from '@/components/providers/auth-wallet-providers'

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthWalletProviders>{children}</AuthWalletProviders>
}
