'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getFundingTimeRemainingMs } from '@/lib/deals'
import { useDealDetail } from '@/hooks/use-deal-detail'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DealFundingPanel } from '@/components/deals/deal-funding-panel'
import { DealDeliveryPanel } from '@/components/deals/deal-delivery-panel'
import { DealMilestoneActions } from '@/components/deals/deal-milestone-actions'
import { DealDetailSidebar } from '@/components/deals/deal-detail-sidebar'
import { DealDetailSkeleton } from '@/components/deals/deal-detail-skeleton'
import { DealDetailTabs } from '@/components/deals/deal-detail-tabs'
import { DealInvestorHero } from '@/components/deals/deal-investor-hero'
import { DealInvestorDetails } from '@/components/deals/deal-investor-details'
import { ArrowLeft, ChevronRight, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'

function useDealStatus(deal: NonNullable<ReturnType<typeof useDealDetail>['deal']>, t: ReturnType<typeof useI18n>['t']) {
  const statusConfig = {
    awaiting_funding: { label: t('dealStatus.awaiting_funding'), color: 'text-accent', bgColor: 'bg-accent/10' },
    funded:           { label: t('dealStatus.funded'),           color: 'text-success', bgColor: 'bg-success/10' },
    in_progress:      { label: t('dealStatus.in_progress'),      color: 'text-warning', bgColor: 'bg-warning/10' },
    milestone_pending:{ label: t('dealStatus.milestone_pending'),color: 'text-warning', bgColor: 'bg-warning/10' },
    completed:        { label: t('dealStatus.completed'),        color: 'text-success', bgColor: 'bg-success/10' },
    disputed:         { label: t('dealStatus.disputed'),         color: 'text-destructive', bgColor: 'bg-destructive/10' },
    released:         { label: t('dealStatus.released'),         color: 'text-success', bgColor: 'bg-success/10' },
  }
  const fundingConfig = {
    open:     { label: t('deals.openForFunding'),             color: 'text-accent',      bgColor: 'bg-accent/10' },
    extended: { label: t('dealDetail.fundingPillExtended'),   color: 'text-warning',     bgColor: 'bg-warning/10' },
    expired:  { label: t('dealDetail.fundingPillExpired'),    color: 'text-destructive', bgColor: 'bg-destructive/10' },
    funded:   { label: t('dealDetail.fundingPillFundedShort'),color: 'text-success',     bgColor: 'bg-success/10' },
  }
  return deal.status === 'awaiting_funding' ? fundingConfig[deal.fundingStatus] : statusConfig[deal.status]
}

function formatFundingRemaining(ms: number, t: ReturnType<typeof useI18n>['t']): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return t('deals.fundingTimeMinutes', { n: Math.max(1, mins) })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('deals.fundingTimeHours', { n: hrs })
  return t('deals.fundingTimeDays', { n: Math.floor(hrs / 24) })
}

export default function DealDetailPage() {
  const { t } = useI18n()
  const params = useParams()
  const dealId = typeof params.id === 'string' ? params.id : params.id?.[0]
  const searchParams = useSearchParams()
  const hasHandledAction = useRef(false)

  const ctx = useDealDetail(dealId)
  const { deal, setDeal, isLoading, userId, userType, isSupplier, isPyme, isAdmin,
    indexerEscrow, pymeReputation, supplierReputation, partyReputationsLoading,
    fetchDeal, supabase, signAndSend, walletInfo, isConnected, handleConnect,
    fundEscrow, changeMilestoneStatus, approveMilestone } = ctx

  const [proofDialogOpen, setProofDialogOpen] = useState(false)
  const [proofMilestoneIndex, setProofMilestoneIndex] = useState<number | null>(null)
  const [proofMilestoneId, setProofMilestoneId] = useState<string | null>(null)

  useEffect(() => {
    if (!deal || isLoading || !userId || hasHandledAction.current) return
    if (!deal.pymeId || deal.pymeId !== userId) return
    if (searchParams.get('action') !== 'delivery') return
    const dm = deal.milestones.find((m) => (m.name || '').toLowerCase().includes('delivery'))
    if (!dm || dm.status !== 'pending') return
    const idx = deal.milestones.findIndex((m) => m.id === dm.id)
    hasHandledAction.current = true
    setProofMilestoneIndex(idx >= 0 ? idx : 1)
    setProofMilestoneId(dm.id)
    setProofDialogOpen(true)
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }, [deal, isLoading, userId, searchParams])

  if (isLoading) return <DealDetailSkeleton />

  if (!deal) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold">{t('deals.noDeals')}</h1>
            <p className="mb-4 text-muted-foreground">{t('dealDetail.notFoundHelp')}</p>
            <Button asChild><Link href="/deals">{t('common.back')}</Link></Button>
          </div>
        </div>
      </div>
    )
  }

  const status = useDealStatus(deal, t)
  const isFundingOpen = deal.fundingStatus === 'open' || deal.fundingStatus === 'extended'
  const fundingRemainingMs = getFundingTimeRemainingMs(deal.fundingExpiresAt)
  const canFund = userType === 'investor' && Boolean(deal.escrowAddress) && isFundingOpen
  const showInvestorPitch = deal.status === 'awaiting_funding' && isFundingOpen && !isPyme && !isSupplier

  const openProofDialog = (index: number, milestoneId: string) => {
    setProofMilestoneIndex(index)
    setProofMilestoneId(milestoneId)
    setProofDialogOpen(true)
  }

  const shared = { deal, supabase, fetchDeal, signAndSend, isConnected, walletAddress: walletInfo?.address, onDealUpdate: setDeal }
  const fundingProps = { ...shared, isFundingOpen, isPyme, userType, onConnect: handleConnect, canFund, fundEscrow, userId }

  const fundPanel = <DealFundingPanel {...fundingProps} showMobileBar={false} />

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className={`container mx-auto px-4 py-10${showInvestorPitch && canFund ? ' pb-24 lg:pb-10' : ''}`}>
        <div className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/deals" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />{t('deals.title')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-40" aria-hidden />
          <span className="truncate text-foreground/70">{deal.productName || t('deals.viewDeal')}</span>
        </div>

        {showInvestorPitch ? (
          <DealInvestorHero deal={deal} fundingRemainingMs={fundingRemainingMs} isFundingOpen={isFundingOpen}
            canFund={canFund} userType={userType} pymeReputation={pymeReputation}
            supplierReputation={supplierReputation} reputationsLoading={partyReputationsLoading}
            fundDialog={fundPanel} onConnectWallet={handleConnect} />
        ) : (
          <div className="mb-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${status.color} ${status.bgColor} ring-current/20`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.color.replace('text-', 'bg-')}`} aria-hidden />
                    {status.label}
                  </span>
                  {deal.category && <Badge variant="outline" className="capitalize">{deal.category}</Badge>}
                  {(deal.yieldBonusApr ?? 0) > 0 && (
                    <Badge variant="secondary" className="gap-1 bg-success/10 text-success">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      +{deal.yieldBonusApr}% {t('deals.bonusApr').replace('+', '')}
                    </Badge>
                  )}
                </div>
                <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">{deal.productName}</h1>
                <p className="max-w-xl text-lg text-muted-foreground">
                  {deal.description || t('dealDetail.descriptionFallback', { name: deal.pymeName })}
                </p>
              </div>
              <DealFundingPanel {...fundingProps} showMobileBar={showInvestorPitch} />
            </div>
            {deal.status === 'awaiting_funding' && deal.fundingExpiresAt && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('dealDetail.fundingDeadline')} {formatDate(deal.fundingExpiresAt)}
                {isFundingOpen && fundingRemainingMs != null && fundingRemainingMs > 0
                  ? ` (${formatFundingRemaining(fundingRemainingMs, t)})` : ''}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t('common.amount'),   value: formatCurrency(deal.priceUSDC), sub: t('deals.usdc') },
                { label: t('deals.apr'),       value: deal.yieldAPR ? `${deal.yieldAPR.toFixed(1)}%` : '—', sub: t('common.yield'), hi: Boolean(deal.yieldAPR) },
                { label: t('common.term'),     value: String(deal.term),              sub: t('common.days') },
                { label: t('common.quantity'), value: deal.quantity.toLocaleString(), sub: t('dealDetail.units') },
              ].map(({ label, value, sub, hi }) => (
                <div key={label} className={`rounded-xl border px-4 py-3 text-center ${hi ? 'border-success/30 bg-success/5' : 'border-border bg-muted/30'}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className={`mt-1 text-xl font-bold tabular-nums ${hi ? 'text-success' : ''}`}>{value}</p>
                  <p className="text-[11px] text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <DealDeliveryPanel {...shared} open={proofDialogOpen} milestoneIndex={proofMilestoneIndex}
          milestoneId={proofMilestoneId} isPyme={isPyme} isAdmin={isAdmin}
          onOpenChange={setProofDialogOpen} onConnect={handleConnect} approveMilestone={approveMilestone} />

        <div className={`grid gap-8 ${showInvestorPitch ? '' : 'lg:grid-cols-3'}`}>
          <div className={`space-y-6 ${showInvestorPitch ? '' : 'lg:col-span-2'}`}>
            <DealMilestoneActions {...shared} isSupplier={isSupplier} isPyme={isPyme} isAdmin={isAdmin}
              changeMilestoneStatus={changeMilestoneStatus} onOpenProofDialog={openProofDialog} />
            {showInvestorPitch
              ? <DealInvestorDetails deal={deal} indexerEscrow={indexerEscrow} />
              : <DealDetailTabs deal={deal} indexerEscrow={indexerEscrow} />}
          </div>
          {!showInvestorPitch && (
            <DealDetailSidebar deal={deal} isFundingOpen={isFundingOpen} pymeReputation={pymeReputation} />
          )}
        </div>
      </div>
    </div>
  )
}
