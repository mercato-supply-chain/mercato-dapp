'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Pencil } from 'lucide-react'
import type { Deal } from '@/lib/types'
import { getFundingTimeRemainingMs } from '@/lib/deals'
import { canEditDeal } from '@/lib/deals/edit'
import { resolveDealViewerRole } from '@/lib/deals/viewer-role'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { useDealDetail } from '@/hooks/use-deal-detail'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { DealFundingPanel } from '@/components/deals/deal-funding-panel'
import { DealDeliveryFlow } from '@/components/deals/deal-delivery-flow'
import { DealRepaymentPanel } from '@/components/deals/deal-repayment-panel'
import {
  InvestorFundActions,
  InvestorFundingProvider,
  InvestorMobileFundBar,
} from '@/components/deals/actions/investor-fund-actions'
import {
  PymeExtendFundingDialog,
  PymeFundingActions,
} from '@/components/deals/actions/pyme-funding-actions'
import { AdminReopenActions } from '@/components/deals/actions/admin-reopen-actions'
import { AdminSettleSupplierAction } from '@/components/deals/actions/admin-settle-supplier-action'
import {
  AuthenticatedViewerFundingNotice,
  GuestFundingNotice,
  GuestHeroFundingActions,
} from '@/components/deals/actions/funding-status-notice'
import { SupplierShipActions } from '@/components/deals/actions/supplier-ship-actions'
import { PymeConfirmDeliveryActions } from '@/components/deals/actions/pyme-confirm-delivery-actions'
import { PymeRepayActions } from '@/components/deals/actions/pyme-repay-actions'
import { AdminReleaseActions } from '@/components/deals/actions/admin-release-actions'
import { DealDetailSidebar } from '@/components/deals/deal-detail-sidebar'
import { DealDetailSkeleton } from '@/components/deals/deal-detail-skeleton'
import { DealDetailTabs } from '@/components/deals/deal-detail-tabs'
import { DealInvestorHero } from '@/components/deals/deal-investor-hero'
import { DealInvestorDetails } from '@/components/deals/deal-investor-details'
import { useI18n } from '@/lib/i18n/provider'

export default function DealDetailPage({ initialDeal }: { initialDeal?: Deal } = {}) {
  const { t } = useI18n()
  const params = useParams()
  const dealId = typeof params.id === 'string' ? params.id : params.id?.[0]
  const searchParams = useSearchParams()
  const hasHandledAction = useRef(false)

  const ctx = useDealDetail(dealId, initialDeal)
  const {
    deal,
    setDeal,
    isLoading,
    userId,
    userType,
    isSupplier,
    isPyme,
    isAdmin,
    indexerEscrow,
    pymeReputation,
    supplierReputation,
    partyReputationsLoading,
    fetchDeal,
    supabase,
    walletInfo,
    handleConnect,
    loadError,
    retry,
  } = ctx

  const refreshDeal = useCallback(async () => {
    const updated = await fetchDeal()
    if (updated) setDeal(updated)
  }, [fetchDeal, setDeal])

  useEffect(() => {
    if (!deal || isLoading || !userId || hasHandledAction.current) return
    const action = searchParams.get('action')
    if (action === 'repayment') {
      if (!deal.pymeId || deal.pymeId !== userId) return
      hasHandledAction.current = true
      document.getElementById('repayment-panel')?.scrollIntoView({ behavior: 'smooth' })
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (action === 'ship' || action === 'delivery' || action === 'accept') {
      hasHandledAction.current = true
      document.getElementById('delivery-panel')?.scrollIntoView({ behavior: 'smooth' })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [deal, isLoading, userId, searchParams])

  if (isLoading) return <DealDetailSkeleton />

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main id="main" tabIndex={-1} className="container mx-auto flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold">{t('dealDetail.loadError')}</h1>
            <p className="mb-4 text-muted-foreground">{t('dealDetail.loadErrorHelp')}</p>
            <div className="flex justify-center gap-2">
              <Button type="button" onClick={retry}>
                {t('dealDetail.retry')}
              </Button>
              <Button asChild variant="outline">
                <Link href="/deals">{t('common.back')}</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main id="main" tabIndex={-1} className="container mx-auto flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold">{t('deals.noDeals')}</h1>
            <p className="mb-4 text-muted-foreground">{t('dealDetail.notFoundHelp')}</p>
            <Button asChild>
              <Link href="/deals">{t('common.back')}</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const viewerRole = resolveDealViewerRole({
    userId,
    userType,
    isPyme,
    isSupplier,
    isAdmin,
  })
  const isFundingOpen = deal.fundingStatus === 'open' || deal.fundingStatus === 'extended'
  const fundingRemainingMs = getFundingTimeRemainingMs(deal.fundingExpiresAt)
  const showMobileInvestorBar =
    viewerRole === 'investor' &&
    deal.status === 'awaiting_funding' &&
    isFundingOpen &&
    Boolean(deal.supplierAddress)
  const showInvestorPitch =
    deal.status === 'awaiting_funding' &&
    isFundingOpen &&
    !isPyme &&
    !isSupplier &&
    !isAdmin
  const showEditDeal = canEditDeal(deal, { userId, isPyme, isAdmin })

  const editDealButton = showEditDeal ? (
    <Button asChild variant="outline" size="sm" className="gap-1.5">
      <Link href={`/deals/${deal.id}/edit`}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        {t('dealDetail.editDealCta')}
      </Link>
    </Button>
  ) : null

  const fundingActions = (() => {
    switch (viewerRole) {
      case 'investor':
        return (
          <InvestorFundActions
            deal={deal}
            isFundingOpen={isFundingOpen}
            supabase={supabase}
            fetchDeal={fetchDeal}
            onDealUpdate={setDeal}
            userId={userId}
          />
        )
      case 'pyme':
        return (
          <PymeFundingActions
            deal={deal}
            isFundingOpen={isFundingOpen}
            supabase={supabase}
            fetchDeal={fetchDeal}
            onDealUpdate={setDeal}
            userId={userId}
          />
        )
      case 'admin':
        return (
          <div className="space-y-2">
            <AdminReopenActions
              deal={deal}
              isFundingOpen={isFundingOpen}
              fetchDeal={fetchDeal}
              onDealUpdate={setDeal}
            />
            {isPyme && deal.status === 'awaiting_funding' && !isFundingOpen ? (
              <PymeExtendFundingDialog
                deal={deal}
                supabase={supabase}
                fetchDeal={fetchDeal}
                onDealUpdate={setDeal}
                userId={userId}
              />
            ) : null}
          </div>
        )
      case 'supplier':
      case 'authenticated_viewer':
        return (
          <AuthenticatedViewerFundingNotice
            deal={deal}
            isFundingOpen={isFundingOpen}
          />
        )
      case 'guest':
      default:
        return (
          <GuestFundingNotice
            deal={deal}
            isFundingOpen={isFundingOpen}
          />
        )
    }
  })()

  const heroActions = (() => {
    switch (viewerRole) {
      case 'investor':
        return <div className="w-full [&_button]:w-full">{fundingActions}</div>
      case 'authenticated_viewer':
        return (
          <AuthenticatedViewerFundingNotice
            deal={deal}
            isFundingOpen={isFundingOpen}
          />
        )
      case 'guest':
      default:
        return (
          <GuestHeroFundingActions
            deal={deal}
            isFundingOpen={isFundingOpen}
            onConnectWallet={handleConnect}
          />
        )
    }
  })()

  const settlementAction =
    viewerRole === 'admin' ? (
      <AdminSettleSupplierAction
        deal={deal}
        fetchDeal={fetchDeal}
        onDealUpdate={setDeal}
      />
    ) : null

  const isShipped = Boolean(deal.shippedAt)
  const isDelivered = Boolean(deal.deliveredAt)
  const canViewerShip =
    !isShipped && deal.status !== 'completed' && (isSupplier || isAdmin)
  const canViewerConfirmDelivery =
    isShipped && !isDelivered && deal.repaymentStatus === 'none' && (isPyme || isAdmin)

  const deliveryActions = canViewerShip ? (
    <SupplierShipActions deal={deal} supabase={supabase} onRefresh={refreshDeal} />
  ) : canViewerConfirmDelivery ? (
    <PymeConfirmDeliveryActions deal={deal} supabase={supabase} onRefresh={refreshDeal} />
  ) : null

  const deliveryNotice = (() => {
    if (!isShipped && !isSupplier && !isAdmin) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('dealDetail.deliveryAwaitingSupplier')}
        </p>
      )
    }
    if (isShipped && !isDelivered && !isPyme && !isAdmin) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('dealDetail.deliveryAwaitingBuyer')}
        </p>
      )
    }
    return null
  })()

  const repaymentHeaderNotice =
    viewerRole === 'investor' ? (
      <p className="text-sm text-muted-foreground">
        {t('dealDetail.repaymentInvestorReadOnlyHint')}
      </p>
    ) : null

  const isPlatformReleaseSigner =
    viewerRole !== 'guest' &&
    Boolean(MERCATO_PLATFORM_ADDRESS && walletInfo?.address === MERCATO_PLATFORM_ADDRESS)

  const adminApprovalsNotice =
    (deal.repaymentStatus ?? 'none') === 'order_confirmed' ? (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {t('dealDetail.repaymentAdminCreateHint')}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/admin/approvals">
            {t('dealDetail.repaymentAdminApprovalsLink')}
          </Link>
        </Button>
      </div>
    ) : null

  const repaymentActions = (() => {
    if (viewerRole === 'admin') {
      return (
        <>
          {isPyme ? <PymeRepayActions deal={deal} /> : null}
          {adminApprovalsNotice}
          <AdminReleaseActions deal={deal} />
        </>
      )
    }
    if (viewerRole === 'pyme') {
      return (
        <>
          <PymeRepayActions deal={deal} />
          {isPlatformReleaseSigner ? <AdminReleaseActions deal={deal} /> : null}
        </>
      )
    }
    if (isPlatformReleaseSigner) {
      return <AdminReleaseActions deal={deal} />
    }
    return null
  })()

  const content = (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main id="main" tabIndex={-1} className={`container mx-auto px-4 py-10${showInvestorPitch && showMobileInvestorBar ? ' pb-24 lg:pb-10' : ''}`}>
        <div className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/deals" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t('deals.title')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-40" aria-hidden />
          <span className="truncate text-foreground/70">
            {deal.productName || t('deals.viewDeal')}
          </span>
        </div>

        {showInvestorPitch ? (
          <DealInvestorHero
            deal={deal}
            fundingRemainingMs={fundingRemainingMs}
            isFundingOpen={isFundingOpen}
            pymeReputation={pymeReputation}
            supplierReputation={supplierReputation}
            reputationsLoading={partyReputationsLoading}
            actions={heroActions}
          />
        ) : (
          <DealFundingPanel
            deal={deal}
            isFundingOpen={isFundingOpen}
            fundingRemainingMs={fundingRemainingMs}
            headerSlot={editDealButton}
            settlementAction={settlementAction}
            actions={fundingActions}
          />
        )}

        {deal.status !== 'awaiting_funding' ? (
          <>
            <div className="mb-8">
              <DealDeliveryFlow
                deal={deal}
                actions={deliveryActions}
                statusNotice={deliveryNotice}
              />
            </div>

            <div id="repayment-panel" className="mb-8">
              <DealRepaymentPanel
                deal={deal}
                indexerEscrow={indexerEscrow}
                fetchDeal={fetchDeal}
                onDealUpdate={setDeal}
                headerNotice={repaymentHeaderNotice}
                actions={repaymentActions}
              />
            </div>
          </>
        ) : null}

        <div className={`grid gap-8 ${showInvestorPitch ? '' : 'lg:grid-cols-3'}`}>
          <div className={`space-y-6 ${showInvestorPitch ? '' : 'lg:col-span-2'}`}>
            {showInvestorPitch ? (
              <DealInvestorDetails deal={deal} indexerEscrow={indexerEscrow} />
            ) : (
              <DealDetailTabs deal={deal} indexerEscrow={indexerEscrow} />
            )}
          </div>
          {!showInvestorPitch ? (
            <DealDetailSidebar
              deal={deal}
              isFundingOpen={isFundingOpen}
              pymeReputation={pymeReputation}
            />
          ) : null}
        </div>
      </main>
      {showInvestorPitch && showMobileInvestorBar ? <InvestorMobileFundBar /> : null}
    </div>
  )

  if (viewerRole === 'investor') {
    return (
      <InvestorFundingProvider deal={deal} isFundingOpen={isFundingOpen}>
        {content}
      </InvestorFundingProvider>
    )
  }

  return content
}
