import type { InitializeMultiReleaseEscrowPayload } from '@trustless-work/escrow'
import { repaymentEngagementId, roundUsdc } from '@/lib/deals/repayment-escrow-helpers'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import {
  DEFAULT_FIRST_MILESTONE_PERCENT,
  repaymentEscrowAmount,
  repaymentMilestoneAmount,
} from '@/lib/deals/fees'
import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'

export type TrustlessWorkNetwork = 'testnet' | 'mainnet'

export const TRUSTLESS_WORK_NETWORK: TrustlessWorkNetwork =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'

export type RepaymentMilestoneDraft = {
  readonly description: string
  readonly amount: number
  readonly receiver: string
}

export type RepaymentRoles = {
  readonly approver: string
  readonly serviceProvider: string
  readonly platformAddress: string
  readonly releaseSigner: string
  readonly disputeResolver: string
}

export type RepaymentEscrowDeploymentInput = {
  readonly dealId: string
  readonly productName: string
  readonly principal: number
  readonly aprPercent: number
  readonly termDays: number
  readonly investorAddress: string
  readonly signerChannel: string
  readonly firstMilestonePercent?: number
}

export type TrustlessConfigSnapshot = {
  readonly network: TrustlessWorkNetwork
  readonly platformAddress: string
  readonly disputeResolverAddress?: string
  readonly platformFeePercent: number
  readonly trustline: { readonly address: string; readonly symbol: string }
}

export type RepaymentEscrowDeploymentDraft = {
  readonly dealId: string
  readonly signer: string
  readonly engagementId: string
  readonly title: string
  readonly description: string
  readonly roles: RepaymentRoles
  readonly platformFeePercent: number
  readonly trustline: { readonly address: string; readonly symbol: string }
  readonly escrowType: 'multi-release'
  readonly network: TrustlessWorkNetwork
  /** Authoritative investor address the draft was generated from. */
  readonly sourceInvestor: string
  readonly repayment: {
    readonly principal: number
    readonly investorProfit: number
    readonly investorNetTarget: number
    readonly totalGrossed: number
  }
  readonly milestones: readonly RepaymentMilestoneDraft[]
}

export function defaultRepaymentRoles(config: TrustlessConfigSnapshot): RepaymentRoles {
  return {
    approver: config.platformAddress,
    serviceProvider: config.platformAddress,
    platformAddress: config.platformAddress,
    releaseSigner: config.platformAddress,
    disputeResolver: config.disputeResolverAddress || config.platformAddress,
  }
}
/**
 * Builds the generated deployment draft from authoritative deal + configuration.
 * Deterministic: the reviewed payload is derived exclusively from these inputs.
 */
export function buildRepaymentEscrowDraft(
  input: RepaymentEscrowDeploymentInput,
  config: TrustlessConfigSnapshot,
): RepaymentEscrowDeploymentDraft {
  if (!input.dealId.trim()) throw new Error('Deal is required to build a repayment draft')
  if (!isLikelyStellarAddress(config.platformAddress)) {
    throw new Error(
      'Platform address missing or invalid — configure NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS',
    )
  }
  if (!isLikelyStellarAddress(config.trustline.address)) {
    throw new Error(
      'Trustline address missing or invalid — configure NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS',
    )
  }
  const investorAddress = input.investorAddress.trim()
  if (!isLikelyStellarAddress(investorAddress)) {
    throw new Error('Investor wallet address is required and must be a valid Stellar address')
  }
  if (!isLikelyStellarAddress(input.signerChannel)) {
    throw new Error('Connected signer address must be a valid Stellar address')
  }

  const { profit, total: investorNetTarget } = computeInvestorReturns(
    input.principal,
    input.aprPercent,
    input.termDays,
  )
  const totalGrossed = repaymentEscrowAmount(input.principal, profit)
  const percent = input.firstMilestonePercent ?? DEFAULT_FIRST_MILESTONE_PERCENT
  const firstAmount = repaymentMilestoneAmount(totalGrossed, percent)

  return {
    dealId: input.dealId,
    signer: input.signerChannel,
    engagementId: repaymentEngagementId(input.dealId),
    title: `Repayment · ${input.productName}`,
    description: `SMB multi-release repayment for deal ${input.dealId}`,
    roles: defaultRepaymentRoles(config),
    platformFeePercent: config.platformFeePercent,
    trustline: config.trustline,
    escrowType: 'multi-release',
    network: config.network,
    sourceInvestor: investorAddress,
    repayment: {
      principal: roundUsdc(input.principal),
      investorProfit: profit,
      investorNetTarget,
      totalGrossed,
    },
    milestones: [
      {
        description: `Repayment milestone 1 (${percent}%)`,
        amount: firstAmount,
        receiver: investorAddress,
      },
    ],
  }
}

/** First milestone amount for a given percent of the grossed total. */
export function calculateRepaymentMilestone(
  totalGrossed: number,
  percent: number,
): number {
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return 0
  return repaymentMilestoneAmount(totalGrossed, percent)
}

/** Percentage implied by an absolute milestone amount. */
export function calculateRepaymentPercentageFromAmount(
  totalGrossed: number,
  amount: number,
): number {
  if (!Number.isFinite(totalGrossed) || totalGrossed <= 0) return 0
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.min(100, Math.round((amount / totalGrossed) * 1000) / 10)
}
export type DraftChange = {
  readonly path: string
  readonly generated: string
  readonly reviewed: string
}

/** Diff of editable fields; unchanged fields are omitted. */
export function compareRepaymentEscrowDrafts(
  generated: RepaymentEscrowDeploymentDraft,
  reviewed: RepaymentEscrowDeploymentDraft,
): readonly DraftChange[] {
  const changes: DraftChange[] = []
  if (generated.title !== reviewed.title) {
    changes.push({ path: 'escrow.title', generated: generated.title, reviewed: reviewed.title })
  }
  if (generated.description !== reviewed.description) {
    changes.push({
      path: 'escrow.description',
      generated: generated.description,
      reviewed: reviewed.description,
    })
  }
  const genMilestone = generated.milestones[0]
  const reviewedMilestone = reviewed.milestones[0]
  if (genMilestone && reviewedMilestone) {
    if (genMilestone.description !== reviewedMilestone.description) {
      changes.push({
        path: 'milestone[0].description',
        generated: genMilestone.description,
        reviewed: reviewedMilestone.description,
      })
    }
    if (genMilestone.amount !== reviewedMilestone.amount) {
      changes.push({
        path: 'milestone[0].amount',
        generated: String(genMilestone.amount),
        reviewed: String(reviewedMilestone.amount),
      })
    }
    if (genMilestone.receiver !== reviewedMilestone.receiver) {
      changes.push({
        path: 'milestone[0].receiver',
        generated: genMilestone.receiver,
        reviewed: reviewedMilestone.receiver,
      })
    }
  }
  const roleKeys: readonly (keyof RepaymentRoles)[] = [
    'approver',
    'serviceProvider',
    'platformAddress',
    'releaseSigner',
    'disputeResolver',
  ]
  for (const role of roleKeys) {
    if (generated.roles[role] !== reviewed.roles[role]) {
      changes.push({
        path: `roles.${role}`,
        generated: generated.roles[role],
        reviewed: reviewed.roles[role],
      })
    }
  }
  return changes
}

/** Maps the reviewed draft to the wire shape Trustless Work expects. */
export function toTrustlessWorkDeploymentPayload(
  draft: RepaymentEscrowDeploymentDraft,
): InitializeMultiReleaseEscrowPayload {
  return {
    signer: draft.signer,
    engagementId: draft.engagementId,
    title: draft.title,
    description: draft.description,
    roles: draft.roles,
    platformFee: draft.platformFeePercent,
    trustline: {
      address: draft.trustline.address,
      symbol: draft.trustline.symbol,
    },
    milestones: draft.milestones.map((m) => ({
      description: m.description,
      amount: m.amount,
      receiver: m.receiver,
    })),
  }
}

/**
 * Applies a one-time investor receiver override for this escrow only.
 * The investor profile is never updated here; correcting a stored investor
 * address is a separate, explicit action outside this issue.
 * TODO(163): implement "Update investor profile" as an independent action.
 */
export function applyOneTimeReceiverOverride(
  draft: RepaymentEscrowDeploymentDraft,
  overrideAddress: string,
): RepaymentEscrowDeploymentDraft {
  const trimmed = overrideAddress.trim()
  if (!isLikelyStellarAddress(trimmed)) {
    throw new Error('Override investor receiver must be a valid Stellar address')
  }
  const milestone = draft.milestones[0]
  if (!milestone) {
    throw new Error('No milestone present to override the receiver for')
  }
  return {
    ...draft,
    milestones: [
      { ...milestone, receiver: trimmed },
      ...draft.milestones.slice(1),
    ],
  }
}