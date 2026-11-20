'use client'

import Link from 'next/link'
import { ArrowRight, Clock, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Deal } from '@/lib/types'
import { useI18n } from '@/lib/i18n/provider'

export interface FundingNoticeBaseProps {
  deal: Deal
  isFundingOpen: boolean
}

export interface GuestHeroFundingActionsProps {
  deal: Deal
  isFundingOpen: boolean
  onConnectWallet?: () => void
}

function renderSharedPrecheckNotice(
  deal: Deal,
  isFundingOpen: boolean,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (!isFundingOpen) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {t('dealDetail.fundingExpired')}
      </div>
    )
  }

  if (!deal.supplierAddress) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {t('dealDetail.supplierAddressMissing')}
      </div>
    )
  }

  return null
}

/**
 * Read-only funding status notice for signed-in viewers who do not hold the
 * investor role (e.g. non-party PyMEs, suppliers, or pre-onboarding accounts).
 */
export function AuthenticatedViewerFundingNotice({
  deal,
  isFundingOpen,
}: FundingNoticeBaseProps) {
  const { t } = useI18n()

  if (deal.status !== 'awaiting_funding') return null

  const precheck = renderSharedPrecheckNotice(deal, isFundingOpen, t)
  if (precheck) return precheck

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      {t('dealDetail.onlyInvestorsFund')}
    </div>
  )
}

/**
 * Read-only funding status notice for unauthenticated guests on the standard
 * funding panel (e.g. when the funding window has closed).
 */
export function GuestFundingNotice({
  deal,
  isFundingOpen,
}: FundingNoticeBaseProps) {
  const { t } = useI18n()

  if (deal.status !== 'awaiting_funding') return null

  const precheck = renderSharedPrecheckNotice(deal, isFundingOpen, t)
  if (precheck) return precheck

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      {t('dealDetail.signInInvestorFund')}
    </div>
  )
}

/**
 * Sign-in and wallet connection CTA variant mounted in `DealInvestorHero`
 * strictly for unauthenticated guests during an open funding window.
 */
export function GuestHeroFundingActions({
  deal,
  isFundingOpen,
  onConnectWallet,
}: GuestHeroFundingActionsProps) {
  const { t } = useI18n()

  if (deal.status !== 'awaiting_funding' || !isFundingOpen) return null

  return (
    <>
      <Button asChild size="lg" className="w-full gap-2">
        <Link href="/auth/login">
          <Wallet className="h-5 w-5" aria-hidden />
          {t('dealDetail.signInToFund')}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
      {onConnectWallet ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onConnectWallet}
        >
          {t('dealDetail.connectStellarWallet')}
        </Button>
      ) : null}
    </>
  )
}
