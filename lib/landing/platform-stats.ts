import type { Locale } from '@/lib/i18n/config'
import { toIntlLocale } from '@/lib/i18n/format'

export type LandingPlatformStats = {
  ordersFunded: number
  openForFunding: number
  activeSmes: number
  smesWithActiveDeals: number
  verifiedSuppliers: number
  supplierCountries: number
  capitalMobilized: number
  capitalFundedThisMonth: number
  capitalMonthGrowthPercent: number | null
}

export function formatStatCount(locale: Locale, value: number): string {
  return new Intl.NumberFormat(toIntlLocale(locale)).format(value)
}

export function formatStatMoney(locale: Locale, value: number): string {
  if (value >= 1_000_000) {
    return new Intl.NumberFormat(toIntlLocale(locale), {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}
