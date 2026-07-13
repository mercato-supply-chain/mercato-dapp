'use client'

import Link from 'next/link'
import { ArrowRight, Clock, Lock, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import { investorFundingTotal } from '@/lib/deals/fees'
import { formatUSDC } from '@/lib/format'
import type { Deal } from '@/lib/types'
import type { Reputation } from '@/lib/types'
import { DealPartyTrust } from '@/components/deals/deal-party-trust'
import { useI18n } from '@/lib/i18n/provider'

type DealInvestorHeroProps = {
  deal: Deal
  fundingRemainingMs: number | null
  isFundingOpen: boolean
  canFund: boolean
  userType: string | null
  pymeReputation: Reputation | null
  supplierReputation: Reputation | null
  reputationsLoading?: boolean
  fundDialog: React.ReactNode
  onConnectWallet?: () => void
}

function formatFundingRemaining(
  ms: number,
  t: (key: string, replacements?: Record<string, string | number>) => string,
): string {
  const totalMinutes = Math.floor(ms / (60 * 1000))
  if (totalMinutes < 60) return t('deals.fundingTimeMinutes', { n: Math.max(1, totalMinutes) })
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) return t('deals.fundingTimeHours', { n: totalHours })
  const totalDays = Math.floor(totalHours / 24)
  return t('deals.fundingTimeDays', { n: totalDays })
}

export function DealInvestorHero({
  deal,
  fundingRemainingMs,
  isFundingOpen,
  canFund,
  userType,
  pymeReputation,
  supplierReputation,
  reputationsLoading,
  fundDialog,
  onConnectWallet,
}: DealInvestorHeroProps) {
  const { t } = useI18n()
  const rate = deal.yieldAPR ?? 0
  const fundingTotal =
    deal.investorFundingTotal || investorFundingTotal(deal.priceUSDC)
  const { total } = computeInvestorReturns(deal.priceUSDC, rate, deal.term)

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="secondary" className="bg-emerald-600/10 text-emerald-800 dark:text-emerald-300">
          {t('dealDetail.investorHeroBadge')}
        </Badge>
        {isFundingOpen && fundingRemainingMs != null && fundingRemainingMs > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            {t('dealDetail.fundingClosesIn', {
              time: formatFundingRemaining(fundingRemainingMs, t),
            })}
          </span>
        )}
      </div>

      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{deal.productName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('dealDetail.investorHeroQty', { qty: deal.quantity.toLocaleString() })}
      </p>

      <DealPartyTrust
        pymeName={deal.pymeName}
        pymeId={deal.pymeId}
        pymeReputation={pymeReputation}
        pymeStake={deal.pymeStakeAmount}
        pymeLoading={reputationsLoading}
        supplierName={deal.supplier}
        supplierId={deal.supplierId}
        supplierReputation={supplierReputation}
        supplierLoading={reputationsLoading}
      />

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
            {formatUSDC(fundingTotal)}
            <span className="mx-2 text-muted-foreground font-normal">→</span>
            {formatUSDC(total)}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t('dealDetail.investorHeroMeta', {
              apr: rate.toFixed(2),
              days: deal.term,
            })}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('dealDetail.investorTrustLineDirect')}
          </p>
        </div>

        <div className="w-full shrink-0 space-y-2 lg:max-w-xs">
          {canFund ? (
            <div className="w-full [&_button]:w-full">{fundDialog}</div>
          ) : userType === 'investor' && !deal.supplierAddress ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              {t('dealDetail.supplierAddressMissing')}
            </p>
          ) : userType ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              {t('dealDetail.onlyInvestorsFund')}
            </p>
          ) : (
            <Button asChild size="lg" className="w-full gap-2">
              <Link href="/auth/login">
                <Wallet className="h-5 w-5" aria-hidden />
                {t('dealDetail.signInToFund')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          )}
          {!userType && onConnectWallet && (
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onConnectWallet}>
              {t('dealDetail.connectStellarWallet')}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
