import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import type { Deal } from '@/lib/types'

type StatusConfig = { label: string; pill: string; dot: string }

const STATUS_CONFIG: Record<string, StatusConfig> = {
  awaiting_funding: {
    label: 'Open for funding',
    pill: 'bg-accent/10 text-accent ring-1 ring-accent/20',
    dot: 'bg-accent',
  },
  funded: {
    label: 'Funded',
    pill: 'bg-success/10 text-success ring-1 ring-success/20',
    dot: 'bg-success',
  },
  in_progress: {
    label: 'In progress',
    pill: 'bg-primary/10 text-primary ring-1 ring-primary/20',
    dot: 'bg-primary',
  },
  milestone_pending: {
    label: 'Milestone pending',
    pill: 'bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20',
    dot: 'bg-orange-500',
  },
  completed: {
    label: 'Completed',
    pill: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  disputed: {
    label: 'Disputed',
    pill: 'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
    dot: 'bg-destructive',
  },
  released: {
    label: 'Released',
    pill: 'bg-success/10 text-success ring-1 ring-success/20',
    dot: 'bg-success',
  },
}

export function DealCard({ deal }: { deal: Deal }) {
  const cfg = STATUS_CONFIG[deal.status] ?? STATUS_CONFIG.awaiting_funding
  const isOpen = deal.status === 'awaiting_funding'
  const completedMilestones = deal.milestones.filter((m) => m.status === 'completed').length
  const hasBonus =
    typeof deal.yieldBonusApr === 'number' && deal.yieldBonusApr > 0

  const subtitle = [deal.supplier, deal.pymeName]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(' · ')

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="group flex flex-col rounded-2xl border-2 border-border bg-card transition-all hover:border-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Header */}
      <div className="flex-1 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
            {cfg.label}
          </span>
          {deal.category && (
            <Badge variant="outline" className="text-xs capitalize">
              {deal.category}
            </Badge>
          )}
          {hasBonus && (
            <Badge variant="secondary" className="gap-1 bg-success/10 text-[11px] text-success">
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              +bonus APR
            </Badge>
          )}
        </div>

        <h3 className="mb-1 line-clamp-2 text-base font-bold leading-snug transition-colors group-hover:text-accent">
          {deal.productName}
        </h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="mx-5 mb-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/30">
        <div className="py-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Amount
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">
            {formatCurrency(deal.priceUSDC)}
          </p>
          <p className="text-[10px] text-muted-foreground">USDC</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            APR
          </p>
          {deal.yieldAPR != null ? (
            <p className="mt-1 text-sm font-bold tabular-nums text-success">
              {deal.yieldAPR.toFixed(1)}%
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">—</p>
          )}
          <p className="text-[10px] text-muted-foreground">yield</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Term
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">{deal.term}</p>
          <p className="text-[10px] text-muted-foreground">days</p>
        </div>
      </div>

      {/* Milestones */}
      {deal.milestones.length > 0 && (
        <div className="mx-5 mb-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Milestones</span>
            <span className="tabular-nums">
              {completedMilestones}/{deal.milestones.length} completed
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
          {isOpen ? 'Fund this deal' : 'View deal'}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </div>
      </div>
    </Link>
  )
}
