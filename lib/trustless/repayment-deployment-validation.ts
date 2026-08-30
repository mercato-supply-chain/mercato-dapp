import {
  calculateRepaymentPercentageFromAmount,
  type RepaymentEscrowDeploymentDraft,
  type RepaymentRoles,
} from './repayment-deployment-draft'
import { roundUsdc } from '@/lib/deals/repayment-escrow-helpers'
import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'

export type RepaymentValidationError =
  | { readonly code: 'missing_milestone'; message: string }
  | { readonly code: 'milestone_receiver_missing'; message: string; milestoneIndex: number }
  | { readonly code: 'invalid_receiver_address'; message: string; milestoneIndex: number }
  | { readonly code: 'milestone_amount_non_positive'; message: string; milestoneIndex: number }
  | { readonly code: 'milestone_amount_exceeds_total'; message: string; milestoneIndex: number }
  | { readonly code: 'milestone_percentage_out_of_range'; message: string; milestoneIndex: number }
  | { readonly code: 'unsupported_usdc_precision'; message: string; milestoneIndex: number }
  | { readonly code: 'negative_remaining'; message: string }
  | { readonly code: 'configuration_error'; message: string }
  | { readonly code: 'invalid_role_address'; message: string; role: keyof RepaymentRoles }
  | { readonly code: 'network_mismatch'; message: string }

export type RepaymentValidationWarning =
  | { kind: 'non_default_first_milestone'; message: string }
  | { kind: 'first_milestone_schedules_full'; message: string }
  | { kind: 'manual_first_milestone_amount'; message: string }
  | { kind: 'receiver_override'; message: string }
  | { kind: 'role_override'; message: string; role: keyof RepaymentRoles }
  | { kind: 'escrow_identity_changed'; message: string }

export type RepaymentDraftValidation = {
  readonly ok: boolean
  readonly errors: readonly RepaymentValidationError[]
  readonly warnings: readonly RepaymentValidationWarning[]
}

export type RepaymentRoleOverrides = {
  readonly approver?: string
  readonly serviceProvider?: string
  readonly platformAddress?: string
  readonly releaseSigner?: string
  readonly disputeResolver?: string
}

export type RepaymentRoleValidation = {
  readonly ok: boolean
  readonly errors: readonly RepaymentValidationError[]
  readonly warnings: readonly RepaymentValidationWarning[]
  readonly requiresAdditionalConfirmation: boolean
}
const ACCOUNT_STRKEY = /^G[A-Z2-7]{55}$/

/**
 * Role addresses resolve to Stellar accounts (G…) that sign or act in the
 * escrow. A contract id (C…) cannot occupy a signing role and indicates a
 * config/network family mismatch — treated as a blocking error, not a warning.
 */
function roleFamilyStatus(
  address: string,
  platformAddress: string,
): 'valid' | 'invalid' | 'contract_mismatch' {
  if (!isLikelyStellarAddress(address)) return 'invalid'
  if (/^C[A-Z2-7]{55}$/.test(address)) return 'contract_mismatch'
  if (!ACCOUNT_STRKEY.test(platformAddress)) return 'invalid'
  return 'valid'
}

function hasUsdcPrecision(value: number): boolean {
  return Math.abs(value - roundUsdc(value)) <= 1e-9
}

export function validateRepaymentEscrowDraft(
  draft: RepaymentEscrowDeploymentDraft,
  generated?: RepaymentEscrowDeploymentDraft,
): RepaymentDraftValidation {
  const errors: RepaymentValidationError[] = []
  const warnings: RepaymentValidationWarning[] = []

  const totalGrossed = draft.repayment.totalGrossed
  if (draft.milestones.length === 0) {
    errors.push({ code: 'missing_milestone', message: 'At least one milestone is required' })
  }

  draft.milestones.forEach((milestone, index) => {
    if (!milestone.receiver.trim()) {
      errors.push({
        code: 'milestone_receiver_missing',
        message: `Milestone ${index + 1} has no receiver`,
        milestoneIndex: index,
      })
    } else if (!isLikelyStellarAddress(milestone.receiver)) {
      errors.push({
        code: 'invalid_receiver_address',
        message: `Milestone ${index + 1} receiver is not a valid Stellar address`,
        milestoneIndex: index,
      })
    }
    if (milestone.amount <= 0) {
      errors.push({
        code: 'milestone_amount_non_positive',
        message: `Milestone ${index + 1} amount must be greater than zero`,
        milestoneIndex: index,
      })
    } else if (totalGrossed > 0 && milestone.amount > totalGrossed) {
      errors.push({
        code: 'milestone_amount_exceeds_total',
        message: `Milestone ${index + 1} amount exceeds the grossed repayment total`,
        milestoneIndex: index,
      })
    }
    if (!hasUsdcPrecision(milestone.amount)) {
      errors.push({
        code: 'unsupported_usdc_precision',
        message: `Milestone ${index + 1} amount uses unsupported USDC precision`,
        milestoneIndex: index,
      })
    }
    if (index === 0) {
      const percent = calculateRepaymentPercentageFromAmount(totalGrossed, milestone.amount)
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        errors.push({
          code: 'milestone_percentage_out_of_range',
          message: 'First milestone percentage must be greater than zero and at most 100',
          milestoneIndex: index,
        })
      } else if (percent !== 50) {
        warnings.push({
          kind: 'non_default_first_milestone',
          message: `First milestone is ${percent}% (generated default is 50%)`,
        })
      }
      if (percent === 100) {
        warnings.push({
          kind: 'first_milestone_schedules_full',
          message: 'First milestone schedules 100% of the repayment',
        })
      }
    }
  })

  const scheduled = draft.milestones.reduce((sum, m) => sum + Number(m.amount || 0), 0)
  const remaining = roundUsdc(totalGrossed - scheduled)
  if (totalGrossed > 0 && remaining < 0) {
    errors.push({
      code: 'negative_remaining',
      message: `Milestones schedule more than the grossed total (${remaining.toFixed(2)} USDC remaining)`,
    })
  }

  if (!isLikelyStellarAddress(draft.roles.platformAddress)) {
    errors.push({
      code: 'configuration_error',
      message: 'MERCATO platform address is not configured as a valid Stellar address',
    })
  }

  if (!isLikelyStellarAddress(draft.trustline.address)) {
    errors.push({
      code: 'configuration_error',
      message: 'Trustline/SAC address is not configured as a valid Stellar address',
    })
  }

  if (!draft.trustline.symbol.trim()) {
    errors.push({
      code: 'configuration_error',
      message: 'Asset symbol is not configured',
    })
  }

  if (!isLikelyStellarAddress(draft.signer)) {
    errors.push({
      code: 'configuration_error',
      message: 'Connected signer is not a valid Stellar address',
    })
  }

  if (!draft.engagementId.trim()) {
    errors.push({
      code: 'configuration_error',
      message: 'Engagement ID is missing',
    })
  }

  if (!Number.isFinite(draft.platformFeePercent)) {
    errors.push({
      code: 'configuration_error',
      message: 'Platform fee is not configured',
    })
  }

  if (generated) {
    if (generated.title !== draft.title || generated.description !== draft.description) {
      warnings.push({
        kind: 'escrow_identity_changed',
        message: 'Escrow title or description differs from the generated default',
      })
    }
    const genMilestone = generated.milestones[0]
    const milestone = draft.milestones[0]
    if (genMilestone && milestone) {
      if (Number(genMilestone.amount) !== Number(milestone.amount)) {
        warnings.push({
          kind: 'manual_first_milestone_amount',
          message: 'First milestone amount was edited manually',
        })
      }
      if (genMilestone.receiver !== milestone.receiver) {
        warnings.push({
          kind: 'receiver_override',
          message: 'Investor receiver differs from the generated default',
        })
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}
const ROLE_KEYS: readonly (keyof RepaymentRoles)[] = [
  'approver',
  'serviceProvider',
  'platformAddress',
  'releaseSigner',
  'disputeResolver',
]

export function validateRepaymentRoleOverrides(
  overrides: RepaymentRoleOverrides,
  generated: RepaymentEscrowDeploymentDraft,
): RepaymentRoleValidation {
  const errors: RepaymentValidationError[] = []
  const warnings: RepaymentValidationWarning[] = []

  const platformAddress = generated.roles.platformAddress

  for (const role of ROLE_KEYS) {
    const override = overrides[role]
    if (override === undefined) continue
    const trimmed = override.trim()
    const status = roleFamilyStatus(trimmed, platformAddress)
    if (status === 'invalid') {
      errors.push({
        code: 'invalid_role_address',
        message: `${role} override is not a valid Stellar address`,
        role,
      })
    } else if (status === 'contract_mismatch') {
      errors.push({
        code: 'network_mismatch',
        message: `${role} override does not belong to the same network family as the configured platform wallet`,
      })
    }

    if (generated.roles[role] !== trimmed) {
      warnings.push({
        kind: 'role_override',
        role,
        message: `${role} differs from the generated default`,
      })
    }
  }

  const requiresAdditionalConfirmation =
    (overrides.approver !== undefined &&
      overrides.approver.trim() !== generated.roles.approver) ||
    (overrides.serviceProvider !== undefined &&
      overrides.serviceProvider.trim() !== generated.roles.serviceProvider) ||
    (overrides.disputeResolver !== undefined &&
      overrides.disputeResolver.trim() !== generated.roles.disputeResolver)

  return { ok: errors.length === 0, errors, warnings, requiresAdditionalConfirmation }
}