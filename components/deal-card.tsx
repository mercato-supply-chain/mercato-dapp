import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getFundingTimeRemainingMs } from '@/lib/deals'
import type { Deal } from '@/lib/types'
import { useI18n } from '@/lib/i18n/provider'

type StatusConfig = { label: string; pill: string; dot: string }

const STATUS_CONFIG: Record<string, Omit<StatusConfig, 'label'> & { labelKey: string }> = {
  awaiting_funding: {
    labelKey: 'dealStatus.awaiting_funding',
    pill: 'bg-accent/10 text-accent ring-1 ring-accent/20',
    dot: 'bg-accent',
  },
  funded: {
    labelKey: 'dealStatus.funded',
    pill: 'bg-success/10 text-success ring-1 ring-success/20',
    dot: 'bg-success',
  },
  in_progress: {
    labelKey: 'dealStatus.in_progress',
    pill: 'bg-primary/10 text-primary ring-1 ring-primary/20',
    dot: 'bg-primary',
  },
  milestone_pending: {
    labelKey: 'dealStatus.milestone_pending',
    pill: 'bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20',
    dot: 'bg-orange-500',
  },
  completed: {
    labelKey: 'dealStatus.completed',
    pill: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  disputed: {
    labelKey: 'dealStatus.disputed',
    pill: 'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
    dot: 'bg-destructive',
  },
  released: {
    labelKey: 'dealStatus.released',
    pill: 'bg-success/10 text-success ring-1 ring-success/20',
    dot: 'bg-success',
  },
}

const FUNDING_STATUS_CONFIG: Record<string, StatusConfig> = {
  open: {
    label: 'Open for funding',
    pill: 'bg-accent/10 text-accent ring-1 ring-accent/20',
    dot: 'bg-accent',
  },
  extended: {
    label: 'Extended',
    pill: 'bg-warning/10 text-warning ring-1 ring-warning/20',
    dot: 'bg-warning',
  },
  expired: {
    label: 'Expired',
    pill: 'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
    dot: 'bg-destructive',
  },
  funded: {
    label: 'Funded',
    pill: 'bg-success/10 text-success ring-1 ring-success/20',
    dot: 'bg-success',
  },
}

function formatFundingRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / (60 * 1000))
  if (totalMinutes < 60) return `${Math.max(1, totalMinutes)}m left`
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours}h left`
  const totalDays = Math.floor(totalHours / 24)
  return `${totalDays}d left`
}

export function DealCard({ deal, listIndex }: { deal: Deal; listIndex?: number }) {
  const { t } = useI18n()
  const cfg = STATUS_CONFIG[deal.status] ?? STATUS_CONFIG.awaiting_funding
  const isOpen = deal.status === 'awaiting_funding'
  const completedMilestones = deal.milestones.filter((m) => m.status === 'completed').length
  const hasBonus =
    typeof deal.yieldBonusApr === 'number' && deal.yieldBonusApr > 0
  const fundingRemainingMs = getFundingTimeRemainingMs(deal.fundingExpiresAt)
  const showRemainingFundingTime =
    isFundingPhase &&
    isOpen &&
    fundingRemainingMs != null &&
    fundingRemainingMs > 0

  const subtitle = [deal.supplier, deal.pymeName]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(' · ')

  const staggerMs =
    listIndex != null ? Math.min(listIndex * 42, 360) : undefined

  return (
    <Link
      href={`/deals/${deal.id}`}
      style={
        staggerMs != null
          ? { animationDelay: `${staggerMs}ms` }
          : undefined
      }
      className={cn(
        'group flex flex-col rounded-2xl border-2 border-border bg-card',
        'transition-[transform,box-shadow,border-color] duration-200 ease-out motion-reduce:transition-colors',
        'hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md',
        'active:translate-y-0 active:scale-[0.995] motion-reduce:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        listIndex != null &&
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out motion-safe:fill-mode-backwards',
      )}
    >
      {/* Header */}
      <div className="flex-1 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
            {t(cfg.labelKey)}
          </span>
          {deal.category && (
            <Badge variant="outline" className="text-xs capitalize">
              {deal.category}
            </Badge>
          )}
          {hasBonus && (
            <Badge variant="secondary" className="gap-1 bg-success/10 text-[11px] text-success">
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              {t('deals.bonusApr')}
            </Badge>
          )}
        </div>

        <h3 className="mb-1 line-clamp-2 text-base font-bold leading-snug transition-colors group-hover:text-accent">
          {deal.productName}
        </h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
        {showRemainingFundingTime && (
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {formatFundingRemaining(fundingRemainingMs)}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="mx-5 mb-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/30">
        <div className="py-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('common.amount')}
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">
            {formatCurrency(deal.priceUSDC)}
          </p>
          <p className="text-[10px] text-muted-foreground">{t('deals.usdc')}</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('deals.apr')}
          </p>
          {deal.yieldAPR != null ? (
            <p className="mt-1 text-sm font-bold tabular-nums text-success">
              {deal.yieldAPR.toFixed(1)}%
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">—</p>
          )}
          <p className="text-[10px] text-muted-foreground">{t('common.yield')}</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('common.term')}
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">{deal.term}</p>
          <p className="text-[10px] text-muted-foreground">{t('common.days')}</p>
        </div>
      </div>

      {/* Milestones */}
      {deal.milestones.length > 0 && (
        <div className="mx-5 mb-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('deals.milestones')}</span>
            <span className="tabular-nums">
              {t('deals.completedProgress', {
                completed: completedMilestones,
                total: deal.milestones.length,
              })}
            </span>
          </div>
          <div className="flex gap-1">
            {deal.milestones.map((m) => (
              <div
                key={m.id}
                title={m.name}
                className={`h-1.5 flex-1 rounded-full ${
                  m.status === 'completed'
                    ? 'bg-success'
                    : m.status === 'in_progress'
                      ? 'bg-primary'
                      : m.status === 'disputed'
                        ? 'bg-destructive'
                        : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="p-5 pt-0">
        <div
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            isOpen
              ? 'bg-accent/10 text-accent ring-1 ring-accent/30 group-hover:bg-accent group-hover:text-accent-foreground'
              : 'bg-muted/50 text-foreground group-hover:bg-muted'
          }`}
        >
          {isOpen ? t('deals.fundThisDeal') : t('deals.viewDeal')}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  )
}
