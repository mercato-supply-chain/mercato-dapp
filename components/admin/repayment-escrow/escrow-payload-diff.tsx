'use client'

import { useI18n } from '@/lib/i18n/provider'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'
import { compareRepaymentEscrowDrafts } from '@/lib/trustless/repayment-deployment-draft'

type EscrowPayloadDiffProps = {
  readonly generated: RepaymentEscrowDeploymentDraft
  readonly reviewed: RepaymentEscrowDeploymentDraft
}

/** "Changes from generated values" table — hidden when there are no changes. */
export function EscrowPayloadDiff({ generated, reviewed }: EscrowPayloadDiffProps) {
  const { t } = useI18n()
  const changes = compareRepaymentEscrowDrafts(generated, reviewed)
  if (changes.length === 0) return null

  return (
    <section className="space-y-1 rounded-md border border-border p-3">
      <h3 className="text-sm font-semibold">{t('repaymentEscrow.payloadDiff.title')}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-2 font-medium">{t('repaymentEscrow.payloadDiff.field')}</th>
            <th className="py-1 pr-2 font-medium">{t('repaymentEscrow.payloadDiff.generated')}</th>
            <th className="py-1 font-medium">{t('repaymentEscrow.payloadDiff.final')}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.path} className="border-t border-border/60">
              <td className="py-1 pr-2">{change.path}</td>
              <td className="max-w-[10rem] truncate py-1 pr-2" title={change.generated}>
                {change.generated}
              </td>
              <td className="max-w-[10rem] truncate py-1" title={change.reviewed}>
                {change.reviewed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}