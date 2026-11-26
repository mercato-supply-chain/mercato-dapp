import type { Locale } from './config'
import { formatCurrency, formatDecimal } from '@/lib/format'

/** Explicit regional locales keep SSR and browser output independent of host defaults. */
export const intlLocales: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-MX',
  'pt-BR': 'pt-BR',
}

export function toIntlLocale(locale: string | undefined | null): string {
  return locale && locale in intlLocales ? intlLocales[locale as Locale] : intlLocales.en
}

export function formatMoney(locale: Locale, value: number): string {
  return formatCurrency(value, 'USD', intlLocales[locale], {
    minFractionDigits: 2,
    maxFractionDigits: 2,
  })
}

/** Repayment values already display their USDC unit separately. */
export function formatAmount(locale: Locale, value: number): string {
  return formatDecimal(value, { minFractionDigits: 2, maxFractionDigits: 2 }, intlLocales[locale])
}

/** UTC is deliberate: dates must not shift between the server and browser time zones. */
export function formatLocalizedDate(
  value: string | null,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' },
): string {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(intlLocales[locale], { ...options, timeZone: 'UTC' }).format(date)
}
