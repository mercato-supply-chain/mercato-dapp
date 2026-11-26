'use client'

import { BadgeCheck, Building2, CircleDollarSign, Package } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'
import {
  formatStatCount,
  formatStatMoney,
  type LandingPlatformStats,
} from '@/lib/landing/platform-stats'

const STATS = [
  { key: 'orders', icon: Package, label: 'landing.hero.stats.orders.label' },
  { key: 'smes', icon: Building2, label: 'landing.hero.stats.smes.label' },
  { key: 'suppliers', icon: BadgeCheck, label: 'landing.hero.stats.suppliers.label' },
  { key: 'capital', icon: CircleDollarSign, label: 'landing.hero.stats.capital.label' },
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
    <div aria-busy={!stats} className="hero-stats-grid grid w-full grid-cols-2 gap-x-3 gap-y-4 min-[480px]:grid-cols-2 sm:gap-x-4 lg:grid-cols-4 lg:items-start lg:gap-x-4 lg:gap-y-0 xl:gap-x-5">
      {items.map(({ key, icon: Icon, label, value, delta }) => (
        <div key={key} className="flex min-w-0 items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-pale text-brand-mid md:h-8 md:w-8 dark:bg-brand-mid/20 dark:text-brand-light">
            <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium leading-tight text-muted-foreground dark:text-white/65">
              {t(label)}
            </p>
            <p className="mt-0.5 font-display text-base font-normal tracking-tight text-foreground min-[480px]:text-lg md:text-xl lg:text-[1.35rem] dark:text-white">
              {value ?? <span aria-hidden className="inline-block h-[1em] w-16 rounded bg-muted motion-safe:animate-pulse" />}
            </p>
            <span
              title={delta ?? undefined}
              className="mt-2 inline-flex w-fit max-w-full items-center rounded-full border border-brand-mid/25 bg-brand-pale px-2.5 py-1 text-[11px] font-semibold leading-snug text-brand-dark dark:border-brand-light/25 dark:bg-brand-mid/30 dark:text-brand-light"
            >
              {delta ?? <span aria-hidden className="inline-block h-[1em] w-24 rounded bg-brand-mid/10 motion-safe:animate-pulse" />}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
