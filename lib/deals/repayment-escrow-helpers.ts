import type {
  MultiReleaseMilestone,
  GetEscrowsFromIndexerResponse,
} from '@trustless-work/escrow'
import { repaymentRemainingAmount } from '@/lib/deals/fees'
import type { RepaymentMilestoneCache, RepaymentStatus } from '@/lib/types'

export function repaymentEngagementId(dealId: string): string {
  return `${dealId}:repayment`
}

export function roundUsdc(n: number): number {
  return Math.round(n * 100) / 100
}

export function isMilestoneReleased(
  m: MultiReleaseMilestone | undefined,
): boolean {
  if (!m) return false
  if (m.flags?.released === true) return true
  const s = (m.status ?? '').toLowerCase()
  return s === 'released' || s === 'completed'
}

export function cacheMilestonesFromIndexer(
  escrow: GetEscrowsFromIndexerResponse | null | undefined,
): RepaymentMilestoneCache[] {
  if (!escrow?.milestones?.length) return []
  return escrow.milestones.map((m, index) => {
    const multi = m as MultiReleaseMilestone
    return {
      index,
      description: multi.description ?? `Milestone ${index + 1}`,
      amount: Number(multi.amount ?? 0),
      released: isMilestoneReleased(multi),
    }
  })
}

/** Map legacy single-release DB status for display only (no migration). */
export function normalizeRepaymentDisplayStatus(status: RepaymentStatus): RepaymentStatus {
  return status === 'funded' ? 'ready_to_release' : status
}

/** Derive cached milestone rows + status from indexer snapshot (conservative rules). */
export function reconcileRepaymentFromIndexer(
  escrow: GetEscrowsFromIndexerResponse | null | undefined,
  balance: number,
  totalGrossed: number,
): { milestones: RepaymentMilestoneCache[]; status: RepaymentStatus } {
  const milestones = cacheMilestonesFromIndexer(escrow)
  const status = deriveRepaymentStatusFromMilestones(milestones, balance, totalGrossed)
  return { milestones, status }
}

export function deriveRepaymentStatusFromMilestones(
  milestones: RepaymentMilestoneCache[],
  balance: number,
  totalGrossed = 0,
): RepaymentStatus {
  if (milestones.length === 0) return 'escrow_initialized'
  const allReleased = milestones.every((m) => m.released)
  const scheduled = milestones.reduce((sum, m) => sum + m.amount, 0)
  const remaining =
    totalGrossed > 0
      ? repaymentRemainingAmount(
          totalGrossed,
          milestones.map((m) => m.amount),
        )
      : 0

  if (allReleased) {
    // More repayment still to schedule via updateEscrow
    if (remaining > 0.01) return 'partially_released'
    return 'released'
  }

  const anyReleased = milestones.some((m) => m.released)
  const openAmount = milestones
    .filter((m) => !m.released)
    .reduce((sum, m) => sum + m.amount, 0)
  if (openAmount > 0 && balance + 1e-9 >= openAmount) {
    return 'ready_to_release'
  }
  if (balance > 0) return 'funding'
  return anyReleased || scheduled > 0
    ? anyReleased
      ? 'partially_released'
      : 'escrow_initialized'
    : 'escrow_initialized'
}
