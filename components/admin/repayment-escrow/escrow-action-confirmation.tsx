'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import type { CreateEscrowItem } from '@/lib/admin/types'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'
import type { RepaymentValidationWarning } from '@/lib/trustless/repayment-deployment-validation'
import { EscrowPayloadDiff } from './escrow-payload-diff'
import { useI18n } from '@/lib/i18n/provider'

const EDITABLE_ROLE_KEYS = ['approver', 'serviceProvider', 'disputeResolver'] as const
type EditableRoleKey = (typeof EDITABLE_ROLE_KEYS)[number]

function stringifyValue(value: number): string {
  return value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export type EscrowActionConfirmationProps = {
  readonly item: CreateEscrowItem
  readonly generated: RepaymentEscrowDeploymentDraft
  readonly reviewed: RepaymentEscrowDeploymentDraft
  readonly warnings: readonly RepaymentValidationWarning[]
  readonly requiresRolesConfirmation: boolean
  readonly rolesConfirmed: boolean
  readonly onRolesConfirmedChange: (confirmed: boolean) => void
  readonly submitting: boolean
  readonly confirmDisabled: boolean
  readonly onBack: () => void
  readonly onConfirm: () => void
}

/**
 * Final pre-signature screen. Rendered only after authoritative revalidation
 * passed inside the review dialog; this component is presentational and never
 * rebuilds or re-reads authoritative state.
 */
export function EscrowActionConfirmation({
  item,
  generated,
  reviewed,
  warnings,
  requiresRolesConfirmation,
  rolesConfirmed,
  onRolesConfirmedChange,
  submitting,
  confirmDisabled,
  onBack,
  onConfirm,
}: EscrowActionConfirmationProps) {
  const { t } = useI18n()
  const ROLE_LABELS: Record<EditableRoleKey, string> = {
    approver: t('repaymentEscrow.roles.approver'),
    serviceProvider: t('repaymentEscrow.roles.serviceProvider'),
    disputeResolver: t('repaymentEscrow.roles.disputeResolver'),
  }
  const overriddenRoles = EDITABLE_ROLE_KEYS.filter(
    (role) => reviewed.roles[role] !== generated.roles[role],
  )
  const firstReviewed = reviewed.milestones[0]
  const percent =
    firstReviewed && reviewed.repayment.totalGrossed > 0
      ? Math.round((firstReviewed.amount / reviewed.repayment.totalGrossed) * 1000) / 10
      : 0

  return (
    <>
      <section className="grid gap-x-4 gap-y-1 rounded-md border border-border p-3 sm:grid-cols-2">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.confirmation.network')}</span>
          <span className="font-medium">{reviewed.network}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.confirmation.deal')}</span>
          <span className="max-w-[12rem] truncate font-medium" title={item.dealTitle || item.dealId}>
            {item.dealTitle || item.dealId}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.confirmation.totalGrossed')}</span>
          <span className="font-medium tabular-nums">
            {stringifyValue(reviewed.repayment.totalGrossed)} USDC
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.confirmation.initialMilestone')}</span>
          <span className="font-medium tabular-nums">
            {firstReviewed
              ? `${stringifyValue(firstReviewed.amount)} USDC · ${percent}%`
              : '—'}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.confirmation.investorReceiver')}</span>
          <CopyableCodeLine
            value={firstReviewed?.receiver ?? ''}
            label={t('repaymentEscrow.confirmation.investorReceiver')}
          />
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.confirmation.connectedSigner')}</span>
          <CopyableCodeLine
            value={reviewed.signer}
            label={t('repaymentEscrow.confirmation.connectedSigner')}
          />
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm sm:col-span-2">
          <span className="shrink-0 text-muted-foreground">{t('repaymentEscrow.confirmation.asset')}</span>
          <CopyableCodeLine
            value={reviewed.trustline.address}
            label={`${reviewed.trustline.symbol} · ${reviewed.trustline.address}`}
          />
        </div>
      </section>
      {overriddenRoles.length > 0 && (
        <section className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            {t('repaymentEscrow.confirmation.overriddenRolesTitle')}
          </p>
          <ul className="space-y-0.5">
            {overriddenRoles.map((role) => (
              <li key={role} className="flex items-baseline justify-between gap-3">
                <span className="shrink-0 text-muted-foreground">{ROLE_LABELS[role]}</span>
                <CopyableCodeLine
                  value={reviewed.roles[role]}
                  label={ROLE_LABELS[role]}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <EscrowPayloadDiff generated={generated} reviewed={reviewed} />

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-border p-3 text-sm text-muted-foreground">
          {warnings.map((warning) => (
            <li key={warning.kind} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      )}

      {requiresRolesConfirmation && (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
          <Checkbox
            id="repayment-roles-confirmed"
            checked={rolesConfirmed}
            onCheckedChange={(checked) => onRolesConfirmedChange(checked === true)}
          />
          <Label
            htmlFor="repayment-roles-confirmed"
            className="cursor-pointer text-xs font-normal leading-snug text-muted-foreground"
          >
            {t('repaymentEscrow.confirmation.rolesConfirm')}
          </Label>
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          {t('repaymentEscrow.confirmation.back')}
        </Button>
        <Button type="button" onClick={onConfirm} disabled={confirmDisabled || submitting}>
          {submitting ? t('repaymentEscrow.confirmation.signing') : t('repaymentEscrow.confirmation.signAndSubmit')}
        </Button>
      </DialogFooter>
    </>
  )
}
