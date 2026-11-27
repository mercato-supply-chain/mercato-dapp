'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/provider'
import type { LandingFeedItem } from '@/lib/landing/landing-deal-feed'

type LandingDealCardProps = {
  item: LandingFeedItem
}

export function LandingDealCard({ item }: LandingDealCardProps) {
  const { t } = useI18n()
  const eventLabel =
    item.eventLabel || t(item.eventLabelKey, item.eventLabelParams)
  const action =
    item.eventType === 'open'
      ? t('landing.liveDeals.card.fundDeal')
      : t('landing.liveDeals.card.viewDeal')

  return (
    <Link
      href={item.href}
      className={cn(
        'group grid gap-3 border-b border-border py-5 sm:px-1',
        'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center md:gap-8',
        'hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 140px' }}
    >
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-brand-mid dark:text-brand-light">
            {eventLabel}
          </span>
          {item.isLive ? null : (
            <span className="text-xs text-muted-foreground">
              {t('landing.liveDeals.card.example')}
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-brand-mid dark:group-hover:text-brand-light">
          {item.productName}
        </h3>
        {item.companyLine ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.companyLine}</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('landing.liveDeals.card.amount')}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{item.amountLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('landing.liveDeals.card.term')}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{item.termDays}d</dd>
        </div>
      </dl>

      <span className="text-sm font-medium text-foreground underline-offset-4 group-hover:underline">
        {action}
      </span>
    </Link>
  )
}
