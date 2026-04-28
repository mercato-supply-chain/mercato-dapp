import type React from "react"
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/theme-provider'
import { TrustlessWorkProvider } from '@/lib/trustless/config'
import { WalletProvider } from '@/providers/wallet-provider'
import { Toaster } from '@/components/ui/sonner'
import { I18nProvider } from '@/lib/i18n/provider'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getServerLocale } from '@/lib/i18n/server'

import './globals.css'

export const metadata: Metadata = {
  title: 'MERCATO - Supply Chain Finance Platform',
  description: 'Connect PyMEs, investors, and suppliers through transparent, blockchain-secured escrow for supply chain financing',
  icons: {
    icon: [{ url: '/mercato.svg', type: 'image/svg+xml' }],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getServerLocale()
  const messages = getDictionary(locale)

  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TrustlessWorkProvider>
            <WalletProvider>
              <I18nProvider locale={locale} messages={messages}>
                {children}
                <Toaster />
              </I18nProvider>
            </WalletProvider>
          </TrustlessWorkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
