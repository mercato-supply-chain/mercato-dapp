import type React from 'react'
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { DM_Serif_Display } from 'next/font/google'
import '@pollar/react/styles.css'
import { ThemeProvider } from '@/components/theme-provider'
import { TrustlessWorkProvider } from '@/lib/trustless/config'
import { PollarProvider } from '@/providers/pollar-provider'
import { WalletProvider } from '@/providers/wallet-provider'
import { Toaster } from '@/components/ui/sonner'
import { I18nProvider } from '@/lib/i18n/provider'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getServerLocale } from '@/lib/i18n/server'
import { UserTypeGate } from '@/components/user-type-gate'
import './globals.css'

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

import { JsonLd } from '@/components/seo/json-ld'

export const metadata: Metadata = {
  metadataBase: new URL('https://mercato.app'),
  title: {
    default: 'MERCATO — Supply Chain Finance Platform',
    template: '%s | MERCATO',
  },
  description: 'Connect PyMEs, investors, and suppliers through transparent, blockchain-secured escrow for supply chain financing in Latin America.',
  keywords: ['supply chain finance', 'blockchain escrow', 'PyME financing', 'invoice financing', 'Latin America'],
  icons: {
    icon: [{ url: '/mercato.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'es_MX',
    siteName: 'MERCATO',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'MERCATO Supply Chain Finance' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@mercato_app',
  },
  robots: { index: true, follow: true },
  verification: { google: 'TODO_GSC_VERIFICATION_TOKEN' }, // TODO: GSC Verification token placeholder
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://mercato.app/#organization',
  name: 'MERCATO',
  url: 'https://mercato.app',
  logo: 'https://mercato.app/mercato.svg',
  description: 'Supply chain finance platform connecting PyMEs, investors, and suppliers in Latin America.',
  sameAs: ['https://twitter.com/mercato_app', 'https://linkedin.com/company/mercato'],
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://mercato.app/#website',
  name: 'MERCATO',
  url: 'https://mercato.app',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://mercato.app/deals?search={search_term_string}',
    'query-input': 'required name=search_term_string',
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
    <html lang={locale} className={`scroll-smooth ${GeistSans.variable} ${GeistMono.variable} ${dmSerifDisplay.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PollarProvider>
            <TrustlessWorkProvider>
              <WalletProvider>
                <I18nProvider locale={locale} messages={messages}>
                  <UserTypeGate />
                  {children}
                  <Toaster />
                </I18nProvider>
              </WalletProvider>
            </TrustlessWorkProvider>
          </PollarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
