'use client'

import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { I18nProvider } from '@/lib/i18n/provider'
import type { Locale } from '@/lib/i18n/config'
import type { Messages } from '@/lib/i18n/dictionaries'
import { NavAuthProvider } from '@/components/providers/nav-auth-provider'
import type { NavAuthSnapshot } from '@/lib/navigation/nav-auth'

export function AppProviders({
  children,
  locale,
  messages,
  navAuth,
}: {
  children: ReactNode
  locale: Locale
  messages?: Messages
  navAuth: NavAuthSnapshot
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider locale={locale} messages={messages}>
        <NavAuthProvider initial={navAuth}>{children}</NavAuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
