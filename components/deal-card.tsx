'use client'

import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getFundingTimeRemainingMs } from '@/lib/deals'
import type { Deal } from '@/lib/types'
import { useI18n } from '@/lib/i18n/provider'

const STATUS_LABEL_KEY: Record<string, string> = {
  awaiting_funding: 'dealStatus.awaiting_funding',
  funded: 'dealStatus.funded',
  in_progress: 'dealStatus.in_progress',
  milestone_pending: 'dealStatus.milestone_pending',
  completed: 'dealStatus.completed',
  disputed: 'dealStatus.disputed',
  released: 'dealStatus.released',
}

export function DealCard({ deal, listIndex }: { deal: Deal; listIndex?: number }) {
  const { t } = useI18n()
  const staggerMs =
    listIndex != null ? Math.min(listIndex * 42, 360) : undefined
  const statusLabelKey =
    STATUS_LABEL_KEY[deal.status] ?? STATUS_LABEL_KEY.awaiting_funding
  const isOpen = deal.status === 'awaiting_funding'
  const isFundingPhase =
    deal.fundingStatus === 'open' || deal.fundingStatus === 'extended'
  const completedMilestones = deal.milestones.filter(
    (m) => m.status === 'completed',
  ).length
  const hasBonus =
    typeof deal.yieldBonusApr === 'number' && deal.yieldBonusApr > 0
  const fundingRemainingMs = getFundingTimeRemainingMs(deal.fundingExpiresAt)
  const showRemainingFundingTime =
    isFundingPhase &&
    isOpen &&
    fundingRemainingMs != null &&
    fundingRemainingMs > 0

  const formatFundingRemaining = (ms: number): string => {
    const totalMinutes = Math.floor(ms / (60 * 1000))
    if (totalMinutes < 60) {
      return t('deals.fundingTimeMinutes', { n: Math.max(1, totalMinutes) })
    }
    const totalHours = Math.floor(totalMinutes / 60)
    if (totalHours < 24) {
      return t('deals.fundingTimeHours', { n: totalHours })
    }
    const totalDays = Math.floor(totalHours / 24)
    return t('deals.fundingTimeDays', { n: totalDays })
  }

  return (
    <Link
      href={`/deals/${deal.id}`}
      className={cn(
        'group grid gap-4 border-b border-border py-5 transition-colors first:border-t',
        'md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8',
        'hover:bg-muted/30 sm:px-3',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '0px 420px',
        ...(staggerMs != null ? { animationDelay: `${staggerMs}ms` } : undefined),
      }}
    >
      <div className="min-w-0">
        {(deal.pymeName || deal.supplier) && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {deal.pymeName && (
              <p className="text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent">
                <span className="mr-1.5 text-xs font-normal text-muted-foreground">
                  {t('common.buyer')}
                </span>
                <span>{deal.pymeName}</span>
              </p>
            )}
            {deal.supplier && (
              <p className="text-xs text-muted-foreground">
                <span className="mr-1">{t('common.supplier')}</span>
                <span className="font-medium text-foreground/80">
                  {deal.supplier}
                </span>
              </p>
            )}
          </div>
        )}

        <h3
          className={cn(
            'line-clamp-1 leading-snug',
            deal.pymeName
              ? 'mt-1 text-sm text-foreground/85'
              : 'text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent',
          )}
        >
          {deal.productName}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          <span
            className={cn(
              isOpen ? 'font-medium text-accent' : 'text-muted-foreground',
            )}
          >
            {t(statusLabelKey)}
          </span>
          {deal.category && (
            <>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{deal.category}</span>
            </>
          )}
          {showRemainingFundingTime && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {formatFundingRemaining(fundingRemainingMs)}
              </span>
            </>
          )}
          {deal.milestones.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {t('deals.completedProgress', {
                  completed: completedMilestones,
                  total: deal.milestones.length,
                })}
              </span>
            </>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-4 sm:gap-8 md:text-right">
        <div>
          <dt className="text-[11px] text-muted-foreground">
            {t('common.amount')}
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-foreground sm:text-xl">
            <span>{formatCurrency(deal.priceUSDC)}</span>{' '}
            <span className="text-xs font-normal text-muted-foreground">
              {t('deals.usdc')}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-[11px] text-muted-foreground">
            {t('common.term')}
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-foreground sm:text-xl">
            <span>{deal.term}</span>{' '}
            <span className="text-xs font-normal text-muted-foreground">
              {t('common.days')}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-[11px] text-muted-foreground">
            {t('deals.apr')}
          </dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground sm:text-base">
            {deal.yieldAPR != null ? `${deal.yieldAPR.toFixed(1)}%` : '—'}
            {hasBonus && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {t('deals.bonusApr')}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </Link>
  )
}
