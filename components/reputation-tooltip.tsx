'use client'

import * as React from 'react'
import { Info, ShieldCheck, Coins, Activity, CheckCircle2 } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import type {
  PymeReputation,
  PymeReputationTier,
} from '@/lib/pyme-reputation'

const TIER_DOT: Record<PymeReputationTier, string> = {
  top_performer: 'bg-emerald-500',
  established: 'bg-blue-500',
  building: 'bg-amber-500',
  new: 'bg-muted-foreground/40',
}

const TIER_RULES: { tier: PymeReputationTier; label: string; rule: string }[] = [
  { tier: 'new', label: 'New', rule: 'No funded deals yet' },
  { tier: 'building', label: 'Building', rule: 'At least one deal funded, none completed' },
  { tier: 'established', label: 'Established', rule: '1+ completed deal, under top thresholds' },
  { tier: 'top_performer', label: 'Top performer', rule: '2+ completed deals or $20,000+ repaid' },
]

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

export interface ReputationTooltipProps {
  reputation: PymeReputation
  /** Trigger element. Defaults to a small info icon button. */
  children?: React.ReactNode
  /** Tailwind class merged into the default info trigger. Ignored when children given. */
  triggerClassName?: string
  /** HoverCard side, passed to Radix. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** HoverCard align, passed to Radix. */
  align?: 'start' | 'center' | 'end'
}

/**
 * Explains how the reputation tier is computed for a PYME.
 * Mirrors lib/pyme-reputation.ts exactly so investors can validate the score.
 */
export function ReputationTooltip({
  reputation,
  children,
  triggerClassName,
  side = 'bottom',
  align = 'center',
}: ReputationTooltipProps) {
  const { stats, tier, label, completionRate } = reputation
  const capitalCommitted = stats.totalRepaid + stats.currentDebt
  const activeDeals = Math.max(0, stats.dealsFunded - stats.dealsCompleted)
  const completionPct = Math.round(completionRate * 100)

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label="How is the reputation calculated?"
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              triggerClassName,
            )}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </HoverCardTrigger>

      <HoverCardContent side={side} align={align} className="w-80 p-0">
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-none">
                Reputation breakdown
              </p>
              <p className="text-xs text-muted-foreground">
                Current tier:{' '}
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <span className={cn('inline-block h-2 w-2 rounded-full', TIER_DOT[tier])} />
                  {label}
                </span>
              </p>
            </div>
          </div>

          <ul className="space-y-2.5 text-xs">
            <li className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Coins className="h-3.5 w-3.5" aria-hidden />
                Capital committed
              </span>
              <span className="text-right font-medium tabular-nums">
                {formatPrice(capitalCommitted)}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {formatPrice(stats.currentDebt)} active ·{' '}
                  {formatPrice(stats.totalRepaid)} repaid
                </span>
              </span>
            </li>

            <li className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Deal activity
              </span>
              <span className="text-right font-medium tabular-nums">
                {stats.dealsFunded} funded
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {stats.dealsCompleted} completed · {activeDeals} active
                </span>
              </span>
            </li>

            <li className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Repayment performance
              </span>
              <span className="text-right font-medium tabular-nums">
                {stats.dealsFunded > 0 ? `${completionPct}%` : '—'}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  completed ÷ funded
                </span>
              </span>
            </li>
          </ul>

          <div className="rounded-md border border-border/60 bg-muted/40 p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              How tiers are assigned
            </p>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {TIER_RULES.map((r) => (
                <li
                  key={r.tier}
                  className={cn(
                    'flex items-start gap-1.5',
                    r.tier === tier && 'text-foreground font-medium',
                  )}
                >
                  <span className={cn('mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full', TIER_DOT[r.tier])} />
                  <span>
                    <span className="font-medium">{r.label}:</span> {r.rule}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            All inputs come directly from on-chain deal status and amounts — no
            manual edits.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
