'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ReputationSummaryCard } from '@/components/reputation-summary-card'
import {
  Package,
  Building2,
  Calendar,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Lock,
} from 'lucide-react'
import type { Deal, Reputation } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'

interface DealDetailSidebarProps {
  deal: Deal
  isFundingOpen: boolean
  pymeReputation: Reputation | null
}

export function DealDetailSidebar({ deal, isFundingOpen, pymeReputation }: DealDetailSidebarProps) {
  const { t, messages } = useI18n()

  const stakeholders = [
    {
      icon: <Package className="h-4 w-4 text-accent" aria-hidden />,
      bg: 'bg-accent/10',
      label: t('dealDetail.stakeholderLabelPyme'),
      name: deal.pymeName,
      href: deal.pymeId ? `/pymes/${deal.pymeId}` : undefined,
      stakeAmount: deal.pymeStakeAmount,
    },
    {
      icon: <TrendingUp className="h-4 w-4 text-success" aria-hidden />,
      bg: 'bg-success/10',
      label: t('dealDetail.labelInvestor'),
      name: deal.investorName ?? t('dealDetail.awaitingFundingName'),
      href:
        deal.investorId && deal.investorName ? `/investors/${deal.investorId}` : undefined,
      stakeAmount: undefined,
    },
    {
      icon: <Building2 className="h-4 w-4 text-primary" aria-hidden />,
      bg: 'bg-primary/10',
      label: t('dealDetail.stakeholderLabelSupplier'),
      name: deal.supplier,
      href: deal.supplierId ? `/suppliers/${deal.supplierId}` : undefined,
      stakeAmount: undefined,
    },
  ]

  return (
    <div className="space-y-5">
      {isFundingOpen && deal.yieldAPR != null && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-success">
              <TrendingUp className="h-4 w-4" aria-hidden />
              {t('dealDetail.investorReturn')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <p className="text-sm text-muted-foreground">{t('dealDetail.principal')}</p>
              <p className="font-semibold tabular-nums">{formatCurrency(deal.priceUSDC)}</p>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-sm text-muted-foreground">
                {t('dealDetail.profitLine', {
                  days: deal.term,
                  apr: deal.yieldAPR.toFixed(1),
                })}
              </p>
              <p className="font-semibold tabular-nums text-success">
                +
                {formatCurrency(
                  Math.round(deal.priceUSDC * (deal.yieldAPR / 100) * (deal.term / 365)),
                )}
              </p>
            </div>
            <Separator />
            <div className="flex items-end justify-between">
              <p className="text-sm font-medium">{t('dealDetail.totalRepayment')}</p>
              <p className="text-lg font-bold tabular-nums">
                {formatCurrency(
                  Math.round(
                    deal.priceUSDC * (1 + (deal.yieldAPR / 100) * (deal.term / 365)),
                  ),
                )}
              </p>
            </div>
            {(deal.yieldBonusApr ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('dealDetail.includesBonus', { pct: deal.yieldBonusApr ?? 0 })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <ReputationSummaryCard reputation={pymeReputation} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('dealDetail.stakeholders')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stakeholders.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${s.bg}`}
              >
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                {s.href ? (
                  <Link
                    href={s.href}
                    className="group flex items-center gap-0.5 text-sm font-medium hover:text-accent hover:underline"
                  >
                    <span className="truncate">{s.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium text-muted-foreground">{s.name}</p>
                )}
                {s.stakeAmount && s.stakeAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('dealDetail.trustStake', { amount: formatCurrency(s.stakeAmount) })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" aria-hidden />
            {t('dealDetail.timeline')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-4 border-l border-border pl-5">
            <li className="relative">
              <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-foreground ring-2 ring-background" />
              <p className="text-sm font-medium">{t('dealDetail.dealCreated')}</p>
              <p className="text-xs text-muted-foreground">{formatDate(deal.createdAt)}</p>
            </li>
            {deal.fundedAt ? (
              <li className="relative">
                <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-success ring-2 ring-background" />
                <p className="text-sm font-medium">{t('dealDetail.funded')}</p>
                <p className="text-xs text-muted-foreground">{formatDate(deal.fundedAt)}</p>
              </li>
            ) : (
              <li className="relative">
                <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground bg-background" />
                <p className="text-sm text-muted-foreground">{t('dealDetail.awaitingFunding')}</p>
              </li>
            )}
            {deal.completedAt ? (
              <li className="relative">
                <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-success ring-2 ring-background" />
                <p className="text-sm font-medium">{t('dealDetail.completed')}</p>
                <p className="text-xs text-muted-foreground">{formatDate(deal.completedAt)}</p>
              </li>
            ) : (
              <li className="relative">
                <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground bg-background" />
                <p className="text-sm text-muted-foreground">
                  {t('dealDetail.awaitingCompletion')}
                </p>
              </li>
            )}
          </ol>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" aria-hidden />
            {t('dealDetail.escrowTrustTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {(messages.dealDetail.escrowTrustPoints as string[]).map((point) => (
            <div key={point} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
              <p className="text-xs text-muted-foreground">{point}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
