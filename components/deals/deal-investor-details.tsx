'use client'

import { ChevronDown } from 'lucide-react'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DealFactRow } from '@/components/deals/deal-fact-row'
import { DealOnChainPanel } from '@/components/deals/deal-on-chain-panel'
import { getLocalizedCategoryLabel } from '@/lib/categories'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import type { Deal } from '@/lib/types'
import { useI18n } from '@/lib/i18n/provider'

type DealInvestorDetailsProps = {
  deal: Deal
  indexerEscrow: GetEscrowsFromIndexerResponse | null
}

export function DealInvestorDetails({ deal, indexerEscrow }: DealInvestorDetailsProps) {
  const { t, messages } = useI18n()
  const categoryLabel = deal.category
    ? getLocalizedCategoryLabel(deal.category, messages)
    : null

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('dealDetail.detailsSectionTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <DealFactRow label={t('dealDetail.dealAmount')}>
          <span className="tabular-nums">{formatCurrency(deal.priceUSDC)} USDC</span>
        </DealFactRow>
        <DealFactRow label={t('common.term')}>
          <span className="tabular-nums">
            {deal.term} {t('common.days')}
            {deal.yieldAPR != null && (
              <span className="text-muted-foreground">
                {' '}
                · {deal.yieldAPR.toFixed(1)}% {t('deals.apr')}
              </span>
            )}
          </span>
        </DealFactRow>
        <DealFactRow label={t('common.quantity')}>
          <span className="tabular-nums">
            {deal.quantity.toLocaleString()} {t('dealDetail.units')}
          </span>
        </DealFactRow>
        {categoryLabel && (
          <DealFactRow label={t('dealDetail.categoryLabel')}>{categoryLabel}</DealFactRow>
        )}
        <DealFactRow label={t('dealDetail.labelCreatedShort')}>
          {formatDate(deal.createdAt)}
        </DealFactRow>
        {deal.fundingExpiresAt && (
          <DealFactRow label={t('dealDetail.fundingDeadlineLabel')}>
            {formatDate(deal.fundingExpiresAt)}
          </DealFactRow>
        )}

        {deal.description && (
          <div className="border-b border-border/50 py-3 last:border-0">
            <p className="text-sm text-muted-foreground">{t('dealDetail.descriptionLabel')}</p>
            <p className="mt-1.5 text-sm leading-relaxed">{deal.description}</p>
          </div>
        )}

        <details className="group mt-4 rounded-xl border border-border bg-muted/20 open:bg-muted/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {t('dealDetail.verifyOnChain')}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="border-t border-border/60 px-4 pb-4 pt-3">
            <DealOnChainPanel
              escrowAddress={deal.escrowAddress}
              fundingTxHash={deal.fundingTxHash}
              investorAddress={deal.investorAddress}
              supplierAddress={deal.supplierAddress}
              indexerEscrow={indexerEscrow}
              compact
            />
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
