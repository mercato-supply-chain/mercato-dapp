'use client'

import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Deal } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'
import { investorFundingTotal } from '@/lib/deals/fees'

export interface DealFundingPanelProps {
  deal: Deal
  isFundingOpen: boolean
  fundingRemainingMs?: number | null
  /** Optional header action (such as Edit Deal link for eligible owners/admins). */
  headerSlot?: ReactNode
  /** Optional admin RWA settlement control. */
  settlementAction?: ReactNode
  /** Explicit role-specific funding action variant composed by the parent view. */
  actions?: ReactNode
}

function getDealStatusBadge(
  deal: Deal,
  t: ReturnType<typeof useI18n>['t'],
): { label: string; color: string; bgColor: string } {
  const statusConfig = {
    awaiting_funding: { label: t('dealStatus.awaiting_funding'), color: 'text-accent', bgColor: 'bg-accent/10' },
    funded: { label: t('dealStatus.funded'), color: 'text-success', bgColor: 'bg-success/10' },
    in_progress: { label: t('dealStatus.in_progress'), color: 'text-warning', bgColor: 'bg-warning/10' },
    milestone_pending: { label: t('dealStatus.milestone_pending'), color: 'text-warning', bgColor: 'bg-warning/10' },
    completed: { label: t('dealStatus.completed'), color: 'text-success', bgColor: 'bg-success/10' },
    disputed: { label: t('dealStatus.disputed'), color: 'text-destructive', bgColor: 'bg-destructive/10' },
    released: { label: t('dealStatus.released'), color: 'text-success', bgColor: 'bg-success/10' },
  }
  const fundingConfig = {
    open: { label: t('deals.openForFunding'), color: 'text-accent', bgColor: 'bg-accent/10' },
    extended: { label: t('dealDetail.fundingPillExtended'), color: 'text-warning', bgColor: 'bg-warning/10' },
    expired: { label: t('dealDetail.fundingPillExpired'), color: 'text-destructive', bgColor: 'bg-destructive/10' },
    funded: { label: t('dealDetail.fundingPillFundedShort'), color: 'text-success', bgColor: 'bg-success/10' },
  }
  return deal.status === 'awaiting_funding'
    ? fundingConfig[deal.fundingStatus]
    : statusConfig[deal.status]
}

function formatFundingRemaining(
  ms: number,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return t('deals.fundingTimeMinutes', { n: Math.max(1, mins) })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('deals.fundingTimeHours', { n: hrs })
  return t('deals.fundingTimeDays', { n: Math.floor(hrs / 24) })
}

/**
 * Shared frame for deal status, funding window countdown, core deal terms, and a
 * composed role-specific funding action slot. Contains zero role boolean flags
 * and never imports investor funding controls directly.
 */
export function DealFundingPanel({
  deal,
  isFundingOpen,
  fundingRemainingMs = null,
  headerSlot,
  settlementAction,
  actions,
}: DealFundingPanelProps) {
  const { t } = useI18n()
  const status = getDealStatusBadge(deal, t)
  const fundingTotal = deal.investorFundingTotal || investorFundingTotal(deal.priceUSDC)

  return (
    <div className="mb-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${status.color} ${status.bgColor} ring-current/20`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.color.replace('text-', 'bg-')}`}
                aria-hidden
              />
              {status.label}
            </span>
            {deal.category ? (
              <Badge variant="outline" className="capitalize">
                {deal.category}
              </Badge>
            ) : null}
            {(deal.yieldBonusApr ?? 0) > 0 ? (
              <Badge variant="secondary" className="gap-1 bg-success/10 text-success">
                <Sparkles className="h-3 w-3" aria-hidden />
                +{deal.yieldBonusApr}% {t('deals.bonusApr').replace('+', '')}
              </Badge>
            ) : null}
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {deal.productName}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {deal.description || t('dealDetail.descriptionFallback', { name: deal.pymeName })}
          </p>
        </div>

        {headerSlot || settlementAction || actions ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {headerSlot}
            {settlementAction}
            {actions}
          </div>
        ) : null}
      </div>

      {deal.status === 'awaiting_funding' && deal.fundingExpiresAt ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('dealDetail.fundingDeadline')} {formatDate(deal.fundingExpiresAt)}
          {isFundingOpen && fundingRemainingMs != null && fundingRemainingMs > 0
            ? ` (${formatFundingRemaining(fundingRemainingMs, t)})`
            : ''}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: t('common.amount'),
            value: formatCurrency(deal.priceUSDC),
            sub: t('deals.usdc'),
          },
          {
            label: t('dealDetail.youPayTotal'),
            value: formatCurrency(fundingTotal),
            sub: t('deals.usdc'),
          },
          {
            label: t('deals.apr'),
            value: deal.yieldAPR ? `${deal.yieldAPR.toFixed(1)}%` : '—',
            sub: t('common.yield'),
            hi: Boolean(deal.yieldAPR),
          },
          {
            label: t('common.term'),
            value: String(deal.term),
            sub: t('common.days'),
          },
        ].map(({ label, value, sub, hi }) => (
          <div
            key={label}
            className={`rounded-xl border px-4 py-3 text-center ${
              hi ? 'border-success/30 bg-success/5' : 'border-border bg-muted/30'
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${hi ? 'text-success' : ''}`}>
              {value}
            </p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
