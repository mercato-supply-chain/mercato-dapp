'use client'

import * as React from 'react'
import { ShieldCheck, Info, Coins, Activity, CheckCircle2, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import type { Reputation } from '@/lib/types'
import {
  computeReputationScore,
  getTrustTier,
  TRUST_TIERS,
  type TrustTier,
} from '@/lib/reputation-score'

interface InvestorReputationCardProps {
  reputation: Reputation | null
  className?: string
}

function ScoreBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all', colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function BreakdownTooltip({
  reputation,
  tier,
}: {
  reputation: Reputation
  tier: TrustTier
}) {
  const breakdown = React.useMemo(
    () =>
      computeReputationScore({
        capitalCommitted: reputation.capitalCommitted,
        dealsCompleted: reputation.dealsCompleted,
        dealsFunded: reputation.dealsCompleted, // approximate; full rate = 100% if we only have completed
        stakeAmount: reputation.stakeAmount,
      }),
    [reputation],
  )

  const repaymentPct = Math.round(reputation.repaymentPerformance * 100)

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="How reputation is calculated"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </HoverCardTrigger>

      <HoverCardContent side="bottom" align="center" className="w-80 p-0">
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold leading-none">Reputation Score</p>
              <p className="text-xs text-muted-foreground">
                Current tier:{' '}
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <span className={cn('inline-block h-2 w-2 rounded-full', tier.dotClass)} />
                  {tier.displayLabel}
                </span>
              </p>
            </div>
          </div>

          <ul className="space-y-3 text-xs">
            <li className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Coins className="h-3.5 w-3.5" aria-hidden />
                  Capital deployed
                </span>
                <span className="font-medium tabular-nums">
                  {breakdown.capitalScore}/30 pts
                </span>
              </div>
              <ScoreBar value={breakdown.capitalScore} max={30} colorClass="bg-blue-500" />
              <p className="text-[11px] text-muted-foreground">
                {formatCurrency(reputation.capitalCommitted)} deployed across deals
              </p>
            </li>

            <li className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" aria-hidden />
                  Deals completed
                </span>
                <span className="font-medium tabular-nums">
                  {breakdown.dealsScore}/30 pts
                </span>
              </div>
              <ScoreBar value={breakdown.dealsScore} max={30} colorClass="bg-violet-500" />
              <p className="text-[11px] text-muted-foreground">
                {reputation.dealsCompleted} deal{reputation.dealsCompleted !== 1 ? 's' : ''} fully completed
              </p>
            </li>

            <li className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Repayment performance
                </span>
                <span className="font-medium tabular-nums">
                  {breakdown.repaymentScore}/40 pts
                </span>
              </div>
              <ScoreBar value={breakdown.repaymentScore} max={40} colorClass="bg-emerald-500" />
              <p className="text-[11px] text-muted-foreground">
                {repaymentPct}% completion rate
              </p>
            </li>

            {reputation.stakeAmount > 0 && (
              <li className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Star className="h-3.5 w-3.5" aria-hidden />
                    Stake bonus
                  </span>
                  <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                    +{breakdown.stakeBonus} pts
                  </span>
                </div>
                <ScoreBar value={breakdown.stakeBonus} max={10} colorClass="bg-amber-500" />
                <p className="text-[11px] text-muted-foreground">
                  {formatCurrency(reputation.stakeAmount)} staked as trust signal
                </p>
              </li>
            )}
          </ul>

          <div className="rounded-md border border-border/60 bg-muted/40 p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Score tiers
            </p>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {TRUST_TIERS.map((t) => (
                <li
                  key={t.label}
                  className={cn(
                    'flex items-center gap-1.5',
                    t.label === tier.label && 'font-medium text-foreground',
                  )}
                >
                  <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', t.dotClass)} />
                  <span className="font-medium">{t.displayLabel}</span>
                  <span className="ml-auto">≥ {t.minScore} pts</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Score auto-updates based on on-platform activity: capital deployed, completed deals, and repayment rate. Staking capital adds a trust bonus.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function InvestorReputationCard({ reputation, className }: InvestorReputationCardProps) {
  const score = reputation?.reputationScore ?? reputation?.score ?? 0
  const tier = React.useMemo(() => getTrustTier(score), [score])
  const hasStake = (reputation?.stakeAmount ?? 0) > 0

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          Reputation & Trust
          {reputation && (
            <BreakdownTooltip reputation={reputation} tier={tier} />
          )}
        </CardTitle>
        <CardDescription>
          Investor trust score based on capital deployed and deal performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn('grid gap-4', hasStake ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Score
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-3xl font-semibold tabular-nums">
                {reputation != null ? score : '—'}
              </p>
              {tier && (
                <Badge
                  variant="secondary"
                  className={cn('capitalize gap-1', tier.color)}
                >
                  <span className={cn('inline-block h-2 w-2 rounded-full', tier.dotClass)} />
                  {tier.displayLabel}
                </Badge>
              )}
            </div>
          </div>

          {hasStake && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Trust Stake
              </p>
              <p className="text-3xl font-semibold tabular-nums">
                {formatCurrency(reputation?.stakeAmount ?? 0)}{' '}
                <span className="text-sm font-medium text-muted-foreground">
                  {reputation?.stakeCurrency ?? 'USDC'}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Earning yield in Mercato vault
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
