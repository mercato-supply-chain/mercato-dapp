export const locales = ['en', 'es'] as const
export const defaultLocale = 'en'
export const localeCookieName = 'mercato-locale'

export type Locale = (typeof locales)[number]

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale)
}
