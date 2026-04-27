'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { defaultLocale, isLocale, localeCookieName, type Locale } from './config'
import { getDictionary, type Messages } from './dictionaries'

type Replacements = Record<string, string | number>
type TranslationValue = string | { [key: string]: TranslationValue }

type I18nContextValue = {
  locale: Locale
  messages: Messages
  t: (key: string, replacements?: Replacements) => string
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

function lookup(messages: Messages, key: string): string | undefined {
  const value = key.split('.').reduce<TranslationValue | undefined>((node, part) => {
    if (!node || typeof node === 'string') return undefined
    return node[part]
  }, messages)

  return typeof value === 'string' ? value : undefined
}

function interpolate(value: string, replacements?: Replacements) {
  if (!replacements) return value
  return Object.entries(replacements).reduce(
    (text, [key, replacement]) =>
      text.replaceAll(`{${key}}`, String(replacement)),
    value,
  )
}

export function I18nProvider({
  children,
  locale,
  messages,
}: {
  children: ReactNode
  locale: Locale
  messages: Messages
}) {
  const router = useRouter()
  const [activeLocale, setActiveLocale] = useState(locale)
  const [activeMessages, setActiveMessages] = useState(messages)

  const changeLocale = useCallback(
    (nextLocale: Locale) => {
      if (!isLocale(nextLocale)) return
      document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`
      document.documentElement.lang = nextLocale
      setActiveLocale(nextLocale)
      setActiveMessages(getDictionary(nextLocale))
      router.refresh()
    },
    [router],
  )

  const t = useCallback(
    (key: string, replacements?: Replacements) =>
      interpolate(
        lookup(activeMessages, key) ??
          lookup(getDictionary(defaultLocale), key) ??
          key,
        replacements,
      ),
    [activeMessages],
  )

  const value = useMemo(
    () => ({
      locale: activeLocale,
      messages: activeMessages,
      t,
      setLocale: changeLocale,
    }),
    [activeLocale, activeMessages, changeLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
