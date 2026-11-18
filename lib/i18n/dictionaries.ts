import en from '@/messages/en.json'
import { defaultLocale, isLocale } from './config'
import type { MessageTree } from './messages'

/** The canonical, fully-typed dictionary shape (mirrors `messages/en.json`). */
export type Messages = typeof en

export type { MessageTree }

// Cache for Spanish dictionary (loaded lazily)
let esDict: Messages | null = null

/**
 * English dictionary, statically imported for synchronous fallback.
 * Used by the client provider's `t` function when the active dictionary
 * is not yet loaded or a key is missing.
 */
export const enDict: Messages = en

/**
 * Lazily load the Spanish dictionary from @/messages/es.json.
 * Called only when the locale is 'es'.
 */
async function loadSpanishDictionary(): Promise<Messages> {
  if (!esDict) {
    const module = await import('@/messages/es.json')
    esDict = module.default as Messages
  }
  return esDict
}

/**
 * Get the dictionary for a given locale.
 * Returns English by default (synchronous fallback for backward compatibility).
 * For non-English locales, returns the specific dictionary (loaded lazily).
 *
 * Note: This function is async because the Spanish dictionary may not be present yet.
 * Callers must await it or handle the Promise.
 */
export async function getDictionary(locale: string | undefined | null): Promise<Messages> {
  const resolvedLocale = isLocale(locale) ? locale : defaultLocale

  if (resolvedLocale === 'en') {
    return en
  }

  // For Spanish, load lazily
  if (resolvedLocale === 'es') {
    return loadSpanishDictionary()
  }

  // Fallback for unsupported locales
  throw new Error(`Unsupported locale: ${resolvedLocale}`)
}
