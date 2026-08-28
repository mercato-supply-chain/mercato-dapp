import type {
  FundEscrowPayload,
  GetEscrowsFromIndexerResponse,
  InitializeMultiReleaseEscrowPayload,
  MultiReleaseMilestone,
  MultiReleaseReleaseFundsPayload,
  MultiReleaseResolveDisputePayload,
  MultiReleaseStartDisputePayload,
  UpdateMultiReleaseEscrowPayload,
} from '@trustless-work/escrow'
import {
  DEFAULT_FIRST_MILESTONE_PERCENT,
  PLATFORM_FEE_PERCENT,
  repaymentEscrowAmount,
  repaymentMilestoneAmount,
  repaymentRemainingAmount,
} from '@/lib/deals/fees'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import {
  cacheMilestonesFromIndexer,
  repaymentEngagementId,
  roundUsdc,
} from '@/lib/deals/repayment-escrow-helpers'
import type {
  AddMilestoneParams,
  DeployRepaymentParams,
  DisputeMilestoneParams,
  EscrowBuildResult,
  EscrowTrustline,
  FundRepaymentParams,
  ReleaseMilestoneParams,
  RepaymentEscrowRoles,
  ResolveDisputeParams,
  SendTxResult,
} from '@/lib/deals/repayment-escrow-types'
import type { RepaymentMilestoneCache } from '@/lib/types'

export function requireUnsigned(
  result: EscrowBuildResult,
  failMessage: string,
): string {
  if (result.status !== 'SUCCESS' || !result.unsignedTransaction) {
    throw new Error(failMessage)
  }
  return result.unsignedTransaction
}

export function contractIdFromSendResult(
  result: SendTxResult | undefined,
): string | undefined {
  if (!result) return undefined
  return result.contractId ?? result.escrow?.contractId
}

export function sendFailureMessage(result: SendTxResult): string {
  return 'message' in result && typeof result.message === 'string'
    ? result.message
    : 'Transaction submission failed'
}

export function planRepaymentDeploy(input: {
  params: DeployRepaymentParams
  investorAddress: string
  roles: RepaymentEscrowRoles
  trustline: EscrowTrustline
}): {
  payload: InitializeMultiReleaseEscrowPayload
  totalGrossed: number
  engagementId: string
  initialMilestones: RepaymentMilestoneCache[]
} {
  const { params, investorAddress, roles, trustline } = input
  const { profit } = computeInvestorReturns(
    params.principal,
    params.aprPercent,
    params.termDays,
  )
  const totalGrossed = repaymentEscrowAmount(params.principal, profit)
  const firstPercent =
    params.firstMilestonePercent ?? DEFAULT_FIRST_MILESTONE_PERCENT
  const firstAmount = repaymentMilestoneAmount(totalGrossed, firstPercent)
  if (firstAmount <= 0) {
    throw new Error('First milestone amount must be positive')
  }

  const engagementId = repaymentEngagementId(params.dealId)
  const description = `Repayment milestone 1 (${firstPercent}%)`
  const payload: InitializeMultiReleaseEscrowPayload = {
    signer: params.adminAddress,
    engagementId,
    title: `Repayment · ${params.productName}`,
    description: `SMB multi-release repayment for deal ${params.dealId}`,
    roles,
    platformFee: PLATFORM_FEE_PERCENT,
    trustline: {
      address: trustline.address,
      symbol: trustline.symbol,
    },
    milestones: [
      {
        description,
        amount: firstAmount,
        receiver: investorAddress,
      },
    ],
  }

  return {
    payload,
    totalGrossed,
    engagementId,
    initialMilestones: [
      {
        index: 0,
        description,
        amount: firstAmount,
        released: false,
      },
    ],
  }
}

export function buildFundPayload(
  params: FundRepaymentParams,
): FundEscrowPayload {
  const amount = roundUsdc(params.amount)
  if (amount <= 0) throw new Error('Fund amount must be positive')
  return {
    contractId: params.contractId,
    signer: params.pymeAddress,
    amount,
  }
}

export function buildApprovePayload(params: ReleaseMilestoneParams) {
  return {
    contractId: params.contractId,
    milestoneIndex: String(params.milestoneIndex),
    approver: params.releaseSigner,
  }
}

export function buildReleasePayload(
  params: ReleaseMilestoneParams,
): MultiReleaseReleaseFundsPayload {
  return {
    contractId: params.contractId,
    releaseSigner: params.releaseSigner,
    milestoneIndex: String(params.milestoneIndex),
  }
}

export function buildStartDisputePayload(
  params: DisputeMilestoneParams,
): MultiReleaseStartDisputePayload {
  return {
    contractId: params.contractId,
    signer: params.signer,
    milestoneIndex: String(params.milestoneIndex),
  }
}

export function cleanDistributions(
  distributions: ResolveDisputeParams['distributions'],
): MultiReleaseResolveDisputePayload['distributions'] {
  const cleaned = distributions
    .map((d) => ({
      address: d.address.trim(),
      amount: roundUsdc(d.amount),
    }))
    .filter((d) => d.address && d.amount > 0)
  if (cleaned.length === 0) {
    throw new Error('At least one positive distribution is required')
  }
  return cleaned as MultiReleaseResolveDisputePayload['distributions']
}

export function buildResolveDisputePayload(
  params: ResolveDisputeParams,
): MultiReleaseResolveDisputePayload {
  return {
    contractId: params.contractId,
    disputeResolver: params.disputeResolver,
    milestoneIndex: String(params.milestoneIndex),
    distributions: cleanDistributions(params.distributions),
  }
}

export function planAddMilestone(input: {
  params: AddMilestoneParams
  escrow: GetEscrowsFromIndexerResponse
  totalGrossed: number
  investorAddress: string
  roles: RepaymentEscrowRoles
}): {
  updatePayload: UpdateMultiReleaseEscrowPayload
  amount: number
} {
  const { params, escrow, totalGrossed, investorAddress, roles } = input
  const existing = cacheMilestonesFromIndexer(escrow)
  const remaining = repaymentRemainingAmount(
    totalGrossed,
    existing.map((m) => m.amount),
  )
  const amount = roundUsdc(params.amount ?? remaining)
  if (amount <= 0) {
    throw new Error('No remaining repayment amount to schedule')
  }
  if (totalGrossed > 0 && amount > remaining + 0.01) {
    throw new Error(`Milestone amount exceeds remaining (${remaining} USDC)`)
  }

  const nextIndex = existing.length
  const newMilestone = {
    description:
      params.description?.trim() || `Repayment milestone ${nextIndex + 1}`,
    amount,
    receiver: investorAddress,
  }

  const updatePayload: UpdateMultiReleaseEscrowPayload = {
    contractId: params.contractId,
    signer: params.adminAddress,
    escrow: {
      engagementId: escrow.engagementId,
      title: escrow.title,
      description: escrow.description,
      roles,
      platformFee: escrow.platformFee,
      trustline: escrow.trustline,
      milestones: [
        ...escrow.milestones.map((m) => {
          const multi = m as MultiReleaseMilestone
          return {
            description: multi.description,
            amount: Number(multi.amount ?? 0),
            receiver: multi.receiver || investorAddress,
            status: multi.status,
            flags: multi.flags,
          }
        }),
        newMilestone,
      ],
      isActive: escrow.isActive ?? true,
    },
  }

  return { updatePayload, amount }
}

export function repaymentDueAtIso(termDays: number, now: Date): string {
  const dueAt = new Date(now.getTime())
  dueAt.setDate(dueAt.getDate() + Math.max(1, termDays))
  return dueAt.toISOString()
}
