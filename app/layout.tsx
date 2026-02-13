import type React from "react"
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/theme-provider'
import { TrustlessWorkProvider } from '@/lib/trustless/config'
import { WalletProvider } from '@/providers/wallet-provider'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
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
