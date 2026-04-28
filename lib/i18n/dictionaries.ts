import en from '@/messages/en.json'
import es from '@/messages/es.json'
import { defaultLocale, isLocale, type Locale } from './config'

export type Messages = typeof en

export const dictionaries: Record<Locale, Messages> = {
  en,
  es,
}

export function getDictionary(locale: string | undefined | null): Messages {
  return dictionaries[isLocale(locale) ? locale : defaultLocale]
}
