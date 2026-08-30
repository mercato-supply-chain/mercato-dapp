'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'
import { useI18n } from '@/lib/i18n/provider'
import type { RepaymentEscrowDeploymentDraft } from '@/lib/trustless/repayment-deployment-draft'

const EDITABLE_ROLE_KEYS = ['approver', 'serviceProvider', 'disputeResolver'] as const
type EditableRoleKey = (typeof EDITABLE_ROLE_KEYS)[number]

const ALL_ROLE_KEYS = ['approver', 'serviceProvider', 'disputeResolver', 'releaseSigner', 'connectedSigner'] as const
type AllRoleKey = (typeof ALL_ROLE_KEYS)[number]

type EscrowRoleFieldsProps = {
  readonly draft: RepaymentEscrowDeploymentDraft
  readonly generated: RepaymentEscrowDeploymentDraft
  readonly editing: boolean
  readonly onRoleChange: (role: EditableRoleKey, value: string) => void
}

/**
 * Connected signer is authoritative and read-only; releaseSigner must equal it
 * and is not editable. Editing another displayed role never changes who signs.
 */
export function EscrowRoleFields({
  draft,
  generated,
  editing,
  onRoleChange,
}: EscrowRoleFieldsProps) {
  const { t } = useI18n()
  const ROLE_LABELS: Record<AllRoleKey, string> = {
    approver: t('repaymentEscrow.roles.approver'),
    serviceProvider: t('repaymentEscrow.roles.serviceProvider'),
    disputeResolver: t('repaymentEscrow.roles.disputeResolver'),
    releaseSigner: t('repaymentEscrow.roles.releaseSigner'),
    connectedSigner: t('repaymentEscrow.roles.connectedSigner'),
  }
  const signerNote = (
    <p className="text-xs text-muted-foreground">{t('repaymentEscrow.roles.signerNote')}</p>
  )

  const getRoleValue = (role: AllRoleKey): string => {
    if (role === 'connectedSigner') return draft.signer
    if (role === 'releaseSigner') return draft.roles.releaseSigner
    return draft.roles[role as EditableRoleKey]
  }

  const isRoleOverridden = (role: AllRoleKey): boolean => {
    if (role === 'connectedSigner') return false
    if (role === 'releaseSigner') return draft.roles.releaseSigner !== draft.signer
    return generated.roles[role as EditableRoleKey] !== draft.roles[role as EditableRoleKey] ||
      !isLikelyStellarAddress(draft.roles[role as EditableRoleKey])
  }

  if (!editing) {
    return (
      <section className="space-y-1">
        <h3 className="text-sm font-semibold">{t('repaymentEscrow.roles.title')}</h3>
        {signerNote}
        {ALL_ROLE_KEYS.map((role) => (
          <CopyableCodeLine
            key={role}
            value={getRoleValue(role)}
            label={ROLE_LABELS[role]}
            overridden={isRoleOverridden(role)}
          />
        ))}
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t('repaymentEscrow.roles.title')}</h3>
      {signerNote}
      <CopyableCodeLine value={draft.signer} label={ROLE_LABELS.connectedSigner} />
      {EDITABLE_ROLE_KEYS.map((role) => (
        <div key={role} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor={`repayment-role-${role}`}>{ROLE_LABELS[role]}</Label>
            {draft.roles[role] !== generated.roles[role] && (
              <Badge className="border-transparent bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-400">
                {t('repaymentEscrow.roles.overridden')}
              </Badge>
            )}
          </div>
          <Input
            id={`repayment-role-${role}`}
            className="font-mono text-xs"
            value={draft.roles[role]}
            onChange={(e) => onRoleChange(role, e.target.value)}
          />
        </div>
      ))}
      <CopyableCodeLine
        value={draft.roles.releaseSigner}
        label={ROLE_LABELS.releaseSigner}
      />
    </section>
  )
}