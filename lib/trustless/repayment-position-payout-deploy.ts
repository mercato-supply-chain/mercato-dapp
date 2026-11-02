import type { InitializeMultiReleaseEscrowPayload } from '@trustless-work/escrow'
import { repaymentEngagementId } from '@/lib/deals/repayment-escrow-helpers'
import type {
  EscrowTrustline,
  RepaymentEscrowRoles,
} from '@/lib/deals/repayment-escrow-types'
import { isLikelyStellarAccountId, isLikelyStellarAddress } from '@/lib/defindex/stellar-address'
import type { RepaymentMilestoneCache } from '@/lib/types'
import type { PositionPayoutSchedule } from './repayment-position-payout'

export type PositionPayoutDeployPlan = {
  readonly payload: InitializeMultiReleaseEscrowPayload
  readonly engagementId: string
  readonly totalGrossed: number
  readonly totalNet: number
  readonly scheduleCommitment: string
  readonly initialMilestones: readonly RepaymentMilestoneCache[]
}

export type PositionPayoutDeployInput = {
  readonly schedule: PositionPayoutSchedule
  readonly dealId: string
  readonly productName: string
  readonly signer: string
  readonly roles: RepaymentEscrowRoles
  readonly trustline: EscrowTrustline
}

function requireAccount(value: string, field: string): string {
  const trimmed = value.trim()
  if (!isLikelyStellarAccountId(trimmed)) {
    throw new Error(`rwa_payout_deploy_invalid: ${field} must be a Stellar account address`)
  }
  return trimmed
}

function atomicToAmount(atomic: string, decimals: number): number {
  const asNumber = Number(BigInt(atomic))
  if (!Number.isSafeInteger(asNumber)) {
    throw new Error('rwa_payout_deploy_invalid: amount exceeds the safe integer range')
  }
  const amount = asNumber / Math.pow(10, decimals)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('rwa_payout_deploy_invalid: amount is not positive')
  }
  return amount
}

/**
 * Maps a frozen position payout schedule to the exact Trustless Work payload
 * and milestone cache. Every milestone keeps its position, tranche and receiver
 * binding so the reviewed schedule can be persisted without re-deriving it.
 */
export function planPositionPayoutDeploy(
  input: PositionPayoutDeployInput,
): PositionPayoutDeployPlan {
  const dealId = input.dealId.trim()
  if (!dealId) throw new Error('rwa_payout_deploy_invalid: dealId is required')
  const productName = input.productName.trim()
  if (!productName) {
    throw new Error('rwa_payout_deploy_invalid: productName is required')
  }
  if (!input.schedule || input.schedule.milestones.length === 0) {
    throw new Error('rwa_payout_deploy_invalid: a frozen payout schedule is required')
  }
  const signer = requireAccount(input.signer, 'signer')
  const roles: RepaymentEscrowRoles = {
    approver: requireAccount(input.roles.approver, 'roles.approver'),
    serviceProvider: requireAccount(input.roles.serviceProvider, 'roles.serviceProvider'),
    platformAddress: requireAccount(input.roles.platformAddress, 'roles.platformAddress'),
    releaseSigner: requireAccount(input.roles.releaseSigner, 'roles.releaseSigner'),
    disputeResolver: requireAccount(input.roles.disputeResolver, 'roles.disputeResolver'),
  }
  const trustlineAddress = input.trustline.address.trim()
  if (!isLikelyStellarAddress(trustlineAddress)) {
    throw new Error('rwa_payout_deploy_invalid: trustline address is invalid')
  }
  const symbol = input.trustline.symbol.trim()
  if (!symbol) throw new Error('rwa_payout_deploy_invalid: trustline symbol is required')

  const platformFee = input.schedule.feePolicy.platformFeeBps / 100
  if (!Number.isFinite(platformFee) || platformFee < 0 || platformFee >= 100) {
    throw new Error('rwa_payout_deploy_invalid: platform fee is out of range')
  }

  const payload: InitializeMultiReleaseEscrowPayload = {
    signer,
    engagementId: repaymentEngagementId(dealId),
    title: `Repayment · ${productName}`,
    description: `RWA position servicing for deal ${dealId}`,
    roles,
    platformFee,
    trustline: { address: trustlineAddress, symbol },
    milestones: input.schedule.milestones.map((milestone) => ({
      description: milestone.description,
      amount: milestone.amount,
      receiver: milestone.receiver,
    })),
  }

  const initialMilestones: RepaymentMilestoneCache[] = input.schedule.milestones.map(
    (milestone) => ({
      index: milestone.milestoneIndex,
      description: milestone.description,
      amount: milestone.amount,
      released: false,
      positionId: milestone.positionId,
      trancheIndex: milestone.trancheIndex,
      receiver: milestone.receiver,
      netAmount: atomicToAmount(milestone.netAtomic, input.schedule.assetDecimals),
      grossAtomic: milestone.grossAtomic,
      netAtomic: milestone.netAtomic,
      scheduleCommitment: input.schedule.commitment,
    }),
  )

  return {
    payload,
    engagementId: repaymentEngagementId(dealId),
    totalGrossed: atomicToAmount(input.schedule.totalGrossAtomic, input.schedule.assetDecimals),
    totalNet: atomicToAmount(input.schedule.totalNetAtomic, input.schedule.assetDecimals),
    scheduleCommitment: input.schedule.commitment,
    initialMilestones,
  }
}
