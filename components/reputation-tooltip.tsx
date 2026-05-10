'use client'

import * as React from 'react'
import { Info, ShieldCheck, Coins, Activity, CheckCircle2 } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/provider'
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

const TIER_TITLE_KEY: Record<PymeReputationTier, string> = {
  new: 'tierNew',
  building: 'tierBuilding',
  established: 'tierEstablished',
  top_performer: 'tierTopPerformer',
}

const RULE_TIERS: PymeReputationTier[] = ['new', 'building', 'established', 'top_performer']

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
  const { t, locale } = useI18n()
  const { stats, tier } = reputation
  const capitalCommitted = stats.totalRepaid + stats.currentDebt
  const activeDeals = Math.max(0, stats.dealsFunded - stats.dealsCompleted)
  const completionPct = Math.round(reputation.completionRate * 100)

  const formatPrice = (value: number) =>
    new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  const tierRules = React.useMemo(
    () =>
      RULE_TIERS.map((r) => {
        const labelKey =
          r === 'new'
            ? 'tierLabelNew'
            : r === 'building'
              ? 'tierLabelBuilding'
              : r === 'established'
                ? 'tierLabelEstablished'
                : 'tierLabelTop'
        const ruleKey =
          r === 'new'
            ? 'tierRuleNew'
            : r === 'building'
              ? 'tierRuleBuilding'
              : r === 'established'
                ? 'tierRuleEstablished'
                : 'tierRuleTop'
        return {
          tier: r,
          label: t(`reputationTooltip.${labelKey}`),
          rule: t(`reputationTooltip.${ruleKey}`),
        }
      }),
    [t],
  )

  const currentTierLabel = t(`pymesPage.${TIER_TITLE_KEY[tier]}`)

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label={t('reputationTooltip.ariaLabel')}
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
              <p className="text-sm font-semibold leading-none">{t('reputationTooltip.title')}</p>
              <p className="text-xs text-muted-foreground">
                {t('reputationTooltip.currentTier')}{' '}
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <span className={cn('inline-block h-2 w-2 rounded-full', TIER_DOT[tier])} />
                  {currentTierLabel}
                </span>
              </p>
            </div>
          </div>

          <ul className="space-y-2.5 text-xs">
            <li className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Coins className="h-3.5 w-3.5" aria-hidden />
                {t('reputationTooltip.capitalCommitted')}
              </span>
              <span className="text-right font-medium tabular-nums">
                {formatPrice(capitalCommitted)}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {t('reputationTooltip.activeRepaidSub', {
                    active: formatPrice(stats.currentDebt),
                    repaid: formatPrice(stats.totalRepaid),
                  })}
                </span>
              </span>
            </li>

            <li className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                {t('reputationTooltip.dealActivity')}
              </span>
              <span className="text-right font-medium tabular-nums">
                {t('reputationTooltip.fundedLine', { count: stats.dealsFunded })}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {t('reputationTooltip.completedActiveSub', {
                    completed: stats.dealsCompleted,
                    active: activeDeals,
                  })}
                </span>
              </span>
            </li>

            <li className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {t('reputationTooltip.repaymentPerformance')}
              </span>
              <span className="text-right font-medium tabular-nums">
                {stats.dealsFunded > 0 ? `${completionPct}%` : t('reputationTooltip.noRate')}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {t('reputationTooltip.ratioHint')}
                </span>
              </span>
            </li>
          </ul>

          <div className="rounded-md border border-border/60 bg-muted/40 p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('reputationTooltip.howTiersTitle')}
            </p>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {tierRules.map((r) => (
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

          <p className="text-[11px] leading-relaxed text-muted-foreground">{t('reputationTooltip.footerNote')}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
