'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { isLocale, localeCookieName, type Locale } from './config'
import { getDictionary, enDict, type Messages } from './dictionaries'
import { translate, scopedMessages, type Replacements } from './messages'

type I18nContextValue = {
  locale: Locale
  messages: Messages
  t: (key: string, replacements?: Replacements) => string
  setLocale: (locale: Locale) => void
}

type PendingLocale = {
  locale: Locale
  messages: Messages
  /** Server messages the switch was made against; new server props supersede it. */
  basis: Messages
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  locale,
  messages,
}: {
  children: ReactNode
  locale: Locale
  messages?: Messages
}) {
  const router = useRouter()
  const [activeLocale, setActiveLocale] = useState(locale)
  const [activeMessages, setActiveMessages] = useState(messages ?? enDict)
  const requestIdRef = useRef(0)

  const changeLocale = useCallback(
    async (nextLocale: Locale) => {
      if (!isLocale(nextLocale)) return
      const requestId = ++requestIdRef.current
      document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`
      document.documentElement.lang = nextLocale
      try {
        const dict = await getDictionary(nextLocale)
        if (requestId !== requestIdRef.current) return // superseded by newer toggle
        setActiveLocale(nextLocale)
        setActiveMessages(dict)
        router.refresh()
      } catch {
        if (requestId !== requestIdRef.current) return
        // Loading failure: keep locale choice but fall back to English messages
        setActiveLocale(nextLocale)
        setActiveMessages(enDict)
        router.refresh()
      }
    },
    [locale, messages, router],
  )

  const t = useCallback(
    (key: string, replacements?: Replacements) =>
      translate(activeMessages, enDict, key, replacements),
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

/** Namespace-scoped access: `t('hero.titleLine1')` resolves `landing.hero.titleLine1`. */
export function useI18nNamespace(namespace: string) {
  const { messages, t } = useI18n()
  const scoped = useMemo(() => scopedMessages(messages, namespace), [messages, namespace])
  const namespaceT = useCallback(
    (key: string, replacements?: Replacements) => t(namespace ? `${namespace}.${key}` : key, replacements),
    [t, namespace],
  )
  return { messages: scoped, t: namespaceT }
}
