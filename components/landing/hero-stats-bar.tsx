'use client'

import { useI18n } from '@/lib/i18n/provider'
import {
  formatStatCount,
  formatStatMoney,
  type LandingPlatformStats,
} from '@/lib/landing/platform-stats'

const STATS = [
  { key: 'orders', label: 'landing.hero.stats.orders.label' },
  { key: 'smes', label: 'landing.hero.stats.smes.label' },
  { key: 'suppliers', label: 'landing.hero.stats.suppliers.label' },
  { key: 'capital', label: 'landing.hero.stats.capital.label' },
] as const

type HeroStatsBarProps = {
  stats?: LandingPlatformStats
}

export function HeroStatsBar({ stats }: HeroStatsBarProps) {
  const { locale, t } = useI18n()

  const items = STATS.map((item) => {
    if (!stats) return { ...item, value: null, delta: null }
    switch (item.key) {
      case 'orders':
        return {
          ...item,
          value: formatStatCount(locale, stats.ordersFunded),
          delta:
            stats.openForFunding > 0
              ? t('landing.hero.stats.orders.deltaOpen', { count: stats.openForFunding })
              : t('landing.hero.stats.orders.deltaNone'),
        }
      case 'smes':
        return {
          ...item,
          value: formatStatCount(locale, stats.activeSmes),
          delta:
            stats.smesWithActiveDeals > 0
              ? t('landing.hero.stats.smes.deltaActive', { count: stats.smesWithActiveDeals })
              : t('landing.hero.stats.smes.deltaOnPlatform'),
        }
      case 'suppliers':
        return {
          ...item,
          value: formatStatCount(locale, stats.verifiedSuppliers),
          delta:
            stats.supplierCountries > 0
              ? stats.supplierCountries === 1
                ? t('landing.hero.stats.suppliers.deltaOneCountry')
                : t('landing.hero.stats.suppliers.deltaCountries', {
                    count: stats.supplierCountries,
                  })
              : t('landing.hero.stats.suppliers.deltaOnPlatform'),
        }
      case 'capital':
        return {
          ...item,
          value: formatStatMoney(locale, stats.capitalMobilized),
          delta:
            stats.capitalMonthGrowthPercent != null &&
            stats.capitalMonthGrowthPercent > 0
              ? t('landing.hero.stats.capital.deltaGrowth', {
                  percent: Math.round(stats.capitalMonthGrowthPercent),
                })
              : stats.capitalFundedThisMonth > 0
                ? t('landing.hero.stats.capital.deltaMonth', {
                    amount: formatStatMoney(locale, stats.capitalFundedThisMonth),
                  })
                : t('landing.hero.stats.capital.deltaLive'),
        }
    }
  })

  return (
    <div
      aria-busy={!stats}
      className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 sm:gap-x-8"
    >
      {items.map(({ key, label, value, delta }) => (
        <div key={key} className="min-w-0">
          <p className="font-display text-2xl tabular-nums tracking-tight text-foreground md:text-[1.65rem]">
            {value ?? (
              <span aria-hidden className="inline-block h-[1em] w-16 rounded bg-muted motion-safe:animate-pulse" />
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t(label)}</p>
          {delta ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/80" title={delta}>
              {delta}
            </p>
          ) : (
            <span
              aria-hidden
              className="mt-0.5 inline-block h-3 w-24 rounded bg-muted/70 motion-safe:animate-pulse"
            />
          )}
        </div>
      ))}
    </div>
  )
}
