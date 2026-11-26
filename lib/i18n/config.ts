export const locales = ['en', 'es', 'pt-BR'] as const
export const defaultLocale = 'en'
export const localeCookieName = 'mercato-locale'

export type Locale = (typeof locales)[number]

const localeAliases: Record<string, Locale> = {
  en: 'en',
  es: 'es',
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  pt_br: 'pt-BR',
  'pt-BR': 'pt-BR',
  pt_BR: 'pt-BR',
}

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale)
}

/** Accepts canonical codes and aliases (`pt`, `pt-br`) used in `?lang=`. */
export function coerceLocale(value: string | undefined | null): Locale | null {
  if (!value) return null
  return localeAliases[value] ?? localeAliases[value.toLowerCase()] ?? null
}

export function languageAlternates(path: string): Record<Locale, string> {
  const base = path.startsWith('/') ? path : `/${path}`
  return {
    en: `${base}?lang=en`,
    es: `${base}?lang=es`,
    'pt-BR': `${base}?lang=pt-BR`,
  }
}
