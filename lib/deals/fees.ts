import { normalizeUSDC } from '@/lib/format'

/** Platform fee charged on investment (investor) and repayment (SMB), as a percent. */
export const PLATFORM_FEE_PERCENT = 1

/**
 * Trustless Work protocol fee deducted on escrow release (percent).
 * @see https://docs.trustlesswork.com/trustless-work/introduction/technology-overview/escrow-lifecycle/release-phase
 */
export const TW_PROTOCOL_FEE_PERCENT = 0.3

/** Combined release deductions so investor net equals principal + interest. */
export const REPAYMENT_RELEASE_FEE_PERCENT =
  PLATFORM_FEE_PERCENT + TW_PROTOCOL_FEE_PERCENT

function roundUsdc(value: number): number {
  return normalizeUSDC(value)
}

/** 1% platform fee on the supplier invoice (principal). */
export function platformFeeAmount(principal: number): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0
  return roundUsdc(principal * (PLATFORM_FEE_PERCENT / 100))
}

/** Total the investor pays at funding: principal + 1% platform fee. */
export function investorFundingTotal(principal: number): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0
  return roundUsdc(principal + platformFeeAmount(principal))
}

/**
 * Amount the SMB must fund into the repayment escrow so that after
 * platform (1%) + Trustless Work (0.3%) deductions, the investor receives
 * `principal + interest`.
 */
export function repaymentEscrowAmount(
  principal: number,
  interest: number,
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0
  const safeInterest = Number.isFinite(interest) && interest > 0 ? interest : 0
  const investorPayout = principal + safeInterest
  const keepFraction = 1 - REPAYMENT_RELEASE_FEE_PERCENT / 100
  if (keepFraction <= 0) return 0
  return roundUsdc(investorPayout / keepFraction)
}

export function investorPayoutAmount(
  principal: number,
  interest: number,
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0
  const safeInterest = Number.isFinite(interest) && interest > 0 ? interest : 0
  return roundUsdc(principal + safeInterest)
}

/** Line-item breakdown for the repayment escrow UI. */
export function repaymentBreakdown(principal: number, interest: number) {
  const safeInterest = Number.isFinite(interest) && interest > 0 ? interest : 0
  const investorPayout = investorPayoutAmount(principal, safeInterest)
  const total = repaymentEscrowAmount(principal, safeInterest)
  const platformFee = roundUsdc(total * (PLATFORM_FEE_PERCENT / 100))
  const protocolFee = roundUsdc(total * (TW_PROTOCOL_FEE_PERCENT / 100))
  return {
    principal: roundUsdc(Math.max(0, principal)),
    interest: roundUsdc(safeInterest),
    investorPayout,
    platformFee,
    protocolFee,
    total,
  }
}

/** Default first repayment milestone as a percent of the grossed total. */
export const DEFAULT_FIRST_MILESTONE_PERCENT = 50

/**
 * Amount for a repayment milestone given the full grossed total and a percent slice.
 * Example: 50% of $10,638.30 → $5,319.15
 */
export function repaymentMilestoneAmount(
  totalGrossed: number,
  percent: number,
): number {
  if (!Number.isFinite(totalGrossed) || totalGrossed <= 0) return 0
  if (!Number.isFinite(percent) || percent <= 0) return 0
  const clamped = Math.min(100, percent)
  return roundUsdc(totalGrossed * (clamped / 100))
}

/**
 * Remaining grossed amount after scheduled/released milestone amounts.
 * Floors at 0 to avoid negative dust from rounding.
 */
export function repaymentRemainingAmount(
  totalGrossed: number,
  scheduledAmounts: number[],
): number {
  if (!Number.isFinite(totalGrossed) || totalGrossed <= 0) return 0
  const scheduled = scheduledAmounts.reduce((sum, n) => {
    if (!Number.isFinite(n) || n <= 0) return sum
    return sum + n
  }, 0)
  return roundUsdc(Math.max(0, totalGrossed - scheduled))
}
