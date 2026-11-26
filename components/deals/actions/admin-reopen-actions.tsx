'use client'

import { Clock } from 'lucide-react'
import { DealAdminReopenPanel } from '@/components/deals/deal-admin-reopen-panel'
import { AuthenticatedViewerFundingNotice } from '@/components/deals/actions/funding-status-notice'
import type { Deal } from '@/lib/types'
import { useI18n } from '@/lib/i18n/provider'

export interface AdminReopenActionsProps {
  deal: Deal
  isFundingOpen: boolean
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
}

export function AdminReopenActions({
  deal,
  isFundingOpen,
  fetchDeal,
  onDealUpdate,
}: AdminReopenActionsProps) {
  const { t } = useI18n()

  if (deal.status !== 'awaiting_funding') return null

  if (isFundingOpen) {
    return (
      <AuthenticatedViewerFundingNotice
        deal={deal}
        isFundingOpen={isFundingOpen}
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {t('dealDetail.fundingExpired')}
      </div>
      <DealAdminReopenPanel
        deal={deal}
        onReopened={async () => {
          const updated = await fetchDeal()
          if (updated) onDealUpdate(updated)
        }}
      />
    </div>
  )
}
