import en from '@/messages/en.json'
import { defaultLocale, coerceLocale, type Locale } from './config'
import type { MessageTree } from './messages'

/** The canonical, fully-typed dictionary shape (mirrors `messages/en.json`). */
export type Messages = typeof en

export type { MessageTree }

export const enDict: Messages = en

const loaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Messages }>> = {
  es: () => import('@/messages/es.json'),
  'pt-BR': () => import('@/messages/pt-BR.json'),
}

/**
 * English is static for a synchronous client fallback. Other locales are
 * dynamically imported so they ship as separate chunks.
 */
export async function getDictionary(locale: string | undefined | null): Promise<Messages> {
  const resolvedLocale = coerceLocale(locale) ?? defaultLocale

  if (resolvedLocale === 'en') {
    return en
  }

  const loaded = await loaders[resolvedLocale]()
  return loaded.default as Messages
}
