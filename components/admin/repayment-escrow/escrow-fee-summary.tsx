'use client'

import { FieldRow } from './escrow-field-row'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import { useI18n } from '@/lib/i18n/provider'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'

type EscrowFeeSummaryProps = {
  readonly draft: RepaymentEscrowDeploymentDraft
}

/** Asset, trustline/SAC and fees — all read-only, config-controlled. */
export function EscrowFeeSummary({ draft }: EscrowFeeSummaryProps) {
  const { t } = useI18n()
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t('repaymentEscrow.fees.title')}</h3>
      <div className="space-y-1">
        <FieldRow label={t('repaymentEscrow.fees.asset')} value={draft.trustline.symbol} />
        <FieldRow label={t('repaymentEscrow.fees.trustline')} value={draft.trustline.address} />
        <FieldRow
          label={t('repaymentEscrow.fees.platformFee')}
          value={t('repaymentEscrow.fees.platformFeeValue', { percent: draft.platformFeePercent })}
        />
        <FieldRow
          label={t('repaymentEscrow.fees.protocolFee')}
          value={t('repaymentEscrow.fees.protocolFeeValue')}
        />
      </div>
      <CopyableCodeLine value={draft.trustline.address} label={t('repaymentEscrow.fees.trustlineAddress')} />
    </section>
  )
}