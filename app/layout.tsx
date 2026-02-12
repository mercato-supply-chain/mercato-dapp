import type React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { TrustlessWorkProvider } from '@/lib/trustless/config'
import { WalletProvider } from '@/providers/wallet-provider'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MERCATO - Supply Chain Finance Platform',
  description: 'Connect PyMEs, investors, and suppliers through transparent, blockchain-secured escrow for supply chain financing',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TrustlessWorkProvider>
            <WalletProvider>
              {children}
              <Toaster />
            </WalletProvider>
          </TrustlessWorkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
