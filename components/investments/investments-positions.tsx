import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/date-utils'
import { formatInvestUsd } from '@/lib/investments/portfolio-metrics'
import type { EnrichedInvestorDeal, InvestorPortfolio } from '@/lib/investments/types'
import { cn } from '@/lib/utils'
import { ActiveInvestmentCard } from './active-investment-card'

export type PositionsTab = 'all' | 'active' | 'completed' | 'other'

type InvestmentsPositionsProps = {
  portfolio: InvestorPortfolio
  tab: PositionsTab
  statusLabel: (status: string) => string
  labels: {
    tabAll: string
    tabActive: string
    tabCompleted: string
    tabOther: string
    tabEmpty: string
    activeHeading: string
    completedHeading: string
    otherHeading: string
    yieldEarned: string
    completedBadge: string
    viewDeal: string
    card: ActiveInvestmentCardProps['labels']
  }
}

type ActiveInvestmentCardProps = React.ComponentProps<typeof ActiveInvestmentCard>

function tr(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template)
}

const TABS: PositionsTab[] = ['all', 'active', 'completed', 'other']

export function InvestmentsPositions({
  portfolio,
  tab,
  statusLabel,
  labels,
}: InvestmentsPositionsProps) {
  const tabLabels: Record<PositionsTab, string> = {
    all: labels.tabAll,
    active: labels.tabActive,
    completed: labels.tabCompleted,
    other: labels.tabOther,
  }

  const otherCount = portfolio.metrics.dealCount - portfolio.metrics.activeCount - portfolio.metrics.completedCount

  const creditPositions = portfolio.rwaPositions ?? []

  const counts: Record<PositionsTab, number> = {
    all: portfolio.metrics.dealCount,
    active: portfolio.metrics.activeCount,
    completed: portfolio.metrics.completedCount,
    other: otherCount,
  }

  const showActive = tab === 'all' || tab === 'active'
  const showCompleted = tab === 'all' || tab === 'completed'
  const showOther = tab === 'all' || tab === 'other'

  const filteredEmpty =
    (tab === 'active' && portfolio.active.length === 0) ||
    (tab === 'completed' && portfolio.completed.length === 0) ||
    (tab === 'other' && portfolio.other.length === 0)

  const totalPages = Math.max(1, Math.ceil(portfolio.history.total / portfolio.history.pageSize))
  const showHistoryPagination = tab !== 'active' && portfolio.history.total > portfolio.history.pageSize

  return (
    <section className="space-y-6">
      {creditPositions.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Credit positions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {creditPositions.map((position) => (
              <li key={position.id} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono text-xs">{position.id.slice(0, 8)}</span>
                <span>Principal {position.principalAtomic}</span>
                <span>Share {position.unitsAtomic}</span>
                <span>Settled {position.settledAtomic}</span>
                <span className="capitalize">{position.state}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === 'all' ? '/dashboard/investments' : `/dashboard/investments?tab=${t}`}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            {tabLabels[t]}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                tab === t ? 'bg-emerald-600/15' : 'bg-muted',
              )}
            >
              {counts[t]}
            </span>
          </Link>
        ))}
      </div>

      {filteredEmpty && (
        <p className="rounded-2xl border border-dashed border-border/80 py-12 text-center text-sm text-muted-foreground">
          {labels.tabEmpty}
        </p>
      )}

      {showActive && portfolio.active.length > 0 && (
        <div className="space-y-4">
          {(tab === 'all' || tab === 'active') && (
            <SectionHeading title={labels.activeHeading} count={portfolio.active.length} variant="active" />
          )}
          <div className="space-y-4">
            {portfolio.active.map((deal) => (
              <ActiveInvestmentCard
                key={deal.id}
                deal={deal}
                statusLabel={statusLabel(deal.status)}
                labels={labels.card}
              />
            ))}
          </div>
        </div>
      )}

      {showCompleted && portfolio.completed.length > 0 && (
        <div>
          <SectionHeading title={labels.completedHeading} count={portfolio.metrics.completedCount} />
          <CompletedList deals={portfolio.completed} labels={labels} />
        </div>
      )}

      {showOther && portfolio.other.length > 0 && (
        <div>
          <SectionHeading title={labels.otherHeading} count={otherCount} />
          <OtherList deals={portfolio.other} statusLabel={statusLabel} />
        </div>
      )}

      {showHistoryPagination && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <Link
            href={`/dashboard/investments?tab=${tab}&page=${portfolio.history.page - 1}`}
            aria-disabled={portfolio.history.page <= 1}
            className={cn(
              'text-sm font-medium text-muted-foreground hover:text-foreground',
              portfolio.history.page <= 1 && 'pointer-events-none opacity-40',
            )}
          >
            ← Previous
          </Link>
          <span className="text-xs text-muted-foreground">
            Page {portfolio.history.page} of {totalPages}
          </span>
          <Link
            href={`/dashboard/investments?tab=${tab}&page=${portfolio.history.page + 1}`}
            aria-disabled={!portfolio.history.hasMore}
            className={cn(
              'text-sm font-medium text-muted-foreground hover:text-foreground',
              !portfolio.history.hasMore && 'pointer-events-none opacity-40',
            )}
          >
            Next →
          </Link>
        </div>
      )}
    </section>
  )
}

function SectionHeading({
  title,
  count,
  variant,
}: {
  title: string
  count: number
  variant?: 'active'
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          variant === 'active'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </div>
  )
}

function CompletedList({
  deals,
  labels,
}: {
  deals: EnrichedInvestorDeal[]
  labels: InvestmentsPositionsProps['labels']
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <ul className="divide-y divide-border">
        {deals.map((deal) => (
          <li key={deal.id}>
            <Link
              href={`/deals/${deal.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm transition-colors hover:bg-muted/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate font-medium">{deal.displayTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {deal.smbName}
                    {deal.funded_at && ` · ${formatDate(deal.funded_at)}`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-right">
                <div>
                  <p className="font-semibold tabular-nums">{formatInvestUsd(deal.amountNum)}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {tr(labels.yieldEarned, { amount: formatInvestUsd(deal.expectedYield, 2) })}
                  </p>
                </div>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {labels.completedBadge}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OtherList({
  deals,
  statusLabel,
}: {
  deals: EnrichedInvestorDeal[]
  statusLabel: (status: string) => string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <ul className="divide-y divide-border">
        {deals.map((deal) => (
          <li key={deal.id}>
            <Link
              href={`/deals/${deal.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm transition-colors hover:bg-muted/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate font-medium">{deal.displayTitle}</p>
                  <p className="text-xs text-muted-foreground">{deal.smbName}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="tabular-nums font-medium">{formatInvestUsd(deal.amountNum)}</p>
                <Badge variant="outline" className="text-xs">
                  {statusLabel(deal.status)}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
