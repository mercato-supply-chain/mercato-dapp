'use client'

import { FieldRow, money } from './escrow-field-row'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'
import { useI18n } from '@/lib/i18n/provider'
import type { CreateEscrowItem } from '@/lib/admin/types'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'

type EscrowDealSummaryProps = {
  readonly item: CreateEscrowItem
  readonly draft: RepaymentEscrowDeploymentDraft
}

/** Deal context — all read-only, derived from authoritative deal data. */
export function EscrowDealSummary({ item, draft }: EscrowDealSummaryProps) {
  const { t } = useI18n()
  const investorValue = item.investorName ?? item.investorAddress ?? t('repaymentEscrow.dealSummary.noWallet')
  const isInvestorAddress = item.investorAddress && isLikelyStellarAddress(item.investorAddress)
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{t('repaymentEscrow.dealSummary.title')}</h3>
      <CopyableCodeLine value={item.dealId} label={t('repaymentEscrow.dealSummary.dealId')} />
      <FieldRow label={t('repaymentEscrow.dealSummary.product')} value={item.dealProductName || item.dealTitle} />
      <FieldRow label={t('repaymentEscrow.dealSummary.pyme')} value={item.pymeName} />
      <FieldRow label={t('repaymentEscrow.dealSummary.supplier')} value={item.supplierName} />
      {isInvestorAddress ? (
        <CopyableCodeLine value={item.investorAddress!} label={t('repaymentEscrow.dealSummary.investor')} />
      ) : (
        <FieldRow
          label={t('repaymentEscrow.dealSummary.investor')}
          value={investorValue}
        />
      )}
      <div className="grid gap-x-4 sm:grid-cols-2">
        <FieldRow label={t('repaymentEscrow.dealSummary.principal')} value={`${money(item.principal)} USDC`} />
        <FieldRow label={t('repaymentEscrow.dealSummary.apr')} value={`${item.aprPercent}%`} />
        <FieldRow label={t('repaymentEscrow.dealSummary.term')} value={`${item.termDays} días`} />
        <FieldRow
          label={t('repaymentEscrow.dealSummary.investorProfit')}
          value={`${money(draft.repayment.investorProfit)} USDC`}
        />
        <FieldRow
          label={t('repaymentEscrow.dealSummary.netTarget')}
          value={`${money(draft.repayment.investorNetTarget)} USDC`}
        />
        <FieldRow
          label={t('repaymentEscrow.dealSummary.totalGrossed')}
          value={`${money(draft.repayment.totalGrossed)} USDC`}
        />
      </div>
    </section>
  )
}