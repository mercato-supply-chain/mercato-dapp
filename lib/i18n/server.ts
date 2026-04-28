import { cookies } from 'next/headers'
import { defaultLocale, isLocale, localeCookieName, type Locale } from './config'
import { getDictionary } from './dictionaries'

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(localeCookieName)?.value
  return isLocale(value) ? value : defaultLocale
}

export async function getServerDictionary() {
  const locale = await getServerLocale()
  return getDictionary(locale)
}
