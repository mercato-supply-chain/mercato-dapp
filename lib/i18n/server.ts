import { cookies } from 'next/headers'
import { defaultLocale, isLocale, localeCookieName, type Locale } from './config'
import { getDictionary, enDict, type Messages } from './dictionaries'
import { translate } from './messages'

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(localeCookieName)?.value
  return isLocale(value) ? value : defaultLocale
}

/** Server-side translate + `{placeholder}` interpolation (same rules as client `t`). */
export function tr(
  messages: Messages,
  key: string,
  replacements?: Record<string, string | number>,
): string {
  return translate(messages, enDict, key, replacements)
}

export function formatMoneyServer(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export async function getServerDictionary() {
  const locale = await getServerLocale()
  return getDictionary(locale)
}

/** DB deal `status` → localized label (`dealStatus.*`). */
export function dealStatusLabel(messages: Messages, status: string): string {
  const key = `dealStatus.${status}`
  const label = tr(messages, key)
  if (label === key) return status.replace(/_/g, ' ')
  return label
}
