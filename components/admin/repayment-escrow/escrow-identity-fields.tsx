'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FieldRow } from './escrow-field-row'
import { useI18n } from '@/lib/i18n/provider'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'

type EscrowIdentityFieldsProps = {
  readonly draft: RepaymentEscrowDeploymentDraft
  readonly generated: RepaymentEscrowDeploymentDraft
  readonly editing: boolean
  readonly onTitleChange: (title: string) => void
  readonly onDescriptionChange: (description: string) => void
}

/** Engagement id / type / network are read-only; title & description are editable. */
export function EscrowIdentityFields({
  draft,
  generated,
  editing,
  onTitleChange,
  onDescriptionChange,
}: EscrowIdentityFieldsProps) {
  const { t } = useI18n()
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t('repaymentEscrow.identity.sectionTitle')}</h3>

      {editing ? (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="repayment-title-input">{t('repaymentEscrow.identity.escrowTitleLabel')}</Label>
              {generated.title !== draft.title && (
                <Badge className="border-transparent bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-400">
                  {t('repaymentEscrow.identity.overridden')}
                </Badge>
              )}
            </div>
            <Input
              id="repayment-title-input"
              value={draft.title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="repayment-description-input">{t('repaymentEscrow.identity.escrowDescLabel')}</Label>
              {generated.description !== draft.description && (
                <Badge className="border-transparent bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-400">
                  {t('repaymentEscrow.identity.overridden')}
                </Badge>
              )}
            </div>
            <Textarea
              id="repayment-description-input"
              value={draft.description}
              onChange={(e) => onDescriptionChange(e.target.value)}
            />
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <FieldRow label={t('repaymentEscrow.identity.engagementId')} value={draft.engagementId} />
          <FieldRow
            label={t('repaymentEscrow.identity.title')}
            value={draft.title}
            overridden={generated.title !== draft.title}
          />
          <FieldRow
            label={t('repaymentEscrow.identity.description')}
            value={draft.description}
            overridden={generated.description !== draft.description}
          />
          <FieldRow label={t('repaymentEscrow.identity.type')} value={t('repaymentEscrow.identity.typeValue')} />
          <FieldRow label={t('repaymentEscrow.identity.network')} value={draft.network} />
        </div>
      )}
    </section>
  )
}