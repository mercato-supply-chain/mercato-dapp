import type { Deal, RepaymentStatus, RepaymentMilestoneCache } from '@/lib/types'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import {
  repaymentEscrowAmount,
  repaymentBreakdown,
  repaymentRemainingAmount,
} from '@/lib/deals/fees'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'

export const FUNDABLE_STATUSES: ReadonlySet<RepaymentStatus> = new Set([
  'escrow_initialized',
  'funding',
  'ready_to_release',
  'partially_released',
  'funded',
])

export interface RepaymentState {
  status: RepaymentStatus
  milestones: RepaymentMilestoneCache[]
  openMilestones: RepaymentMilestoneCache[]
  currentMilestone: RepaymentMilestoneCache | undefined
  escrowAmount: number
  openAmount: number
  remainingToSchedule: number
  defaultFundAmount: number
  breakdown: ReturnType<typeof repaymentBreakdown>
}

export function computeRepaymentState(deal: Deal): RepaymentState {
  const apr = deal.yieldAPR ?? 0
  const { profit } = computeInvestorReturns(deal.priceUSDC, apr, deal.term)
  const breakdown = repaymentBreakdown(deal.priceUSDC, profit)
  const escrowAmount =
    deal.repaymentTotalAmount && deal.repaymentTotalAmount > 0
      ? deal.repaymentTotalAmount
      : repaymentEscrowAmount(deal.priceUSDC, profit)
  const status = deal.repaymentStatus ?? 'none'
  const milestones = deal.repaymentMilestones ?? []
  const openMilestones = milestones.filter((m) => !m.released)
  const openAmount = openMilestones.reduce((sum, m) => sum + m.amount, 0)
  const scheduledAmounts = milestones.map((m) => m.amount)
  const remainingToSchedule = repaymentRemainingAmount(escrowAmount, scheduledAmounts)
  const currentMilestone = openMilestones[0]
  const defaultFundAmount =
    openAmount > 0 ? openAmount : remainingToSchedule > 0 ? remainingToSchedule : escrowAmount

  return {
    status,
    milestones,
    openMilestones,
    currentMilestone,
    escrowAmount,
    openAmount,
    remainingToSchedule,
    defaultFundAmount,
    breakdown,
  }
}

export function canFund(
  isPyme: boolean,
  escrowAddress: string | undefined,
  status: RepaymentStatus,
): boolean {
  return isPyme && Boolean(escrowAddress) && FUNDABLE_STATUSES.has(status)
}

export function canRelease(
  isAdmin: boolean,
  walletAddress: string | undefined,
  escrowAddress: string | undefined,
  currentMilestone: RepaymentMilestoneCache | undefined,
  status: RepaymentStatus,
): boolean {
  return (
    (isAdmin || walletAddress === MERCATO_PLATFORM_ADDRESS) &&
    Boolean(escrowAddress) &&
    Boolean(currentMilestone) &&
    (status === 'ready_to_release' || status === 'funded')
  )
}

export function canAddMilestone(
  isAdmin: boolean,
  walletAddress: string | undefined,
  escrowAddress: string | undefined,
  remainingToSchedule: number,
  status: RepaymentStatus,
): boolean {
  return (
    (isAdmin || walletAddress === MERCATO_PLATFORM_ADDRESS) &&
    Boolean(escrowAddress) &&
    remainingToSchedule > 0 &&
    status !== 'none' &&
    status !== 'order_confirmed'
  )
}
