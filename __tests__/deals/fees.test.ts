import { describe, expect, test } from 'bun:test'
import {
  PLATFORM_FEE_PERCENT,
  TW_PROTOCOL_FEE_PERCENT,
  investorFundingTotal,
  investorPayoutAmount,
  platformFeeAmount,
  repaymentEscrowAmount,
  repaymentMilestoneAmount,
  repaymentRemainingAmount,
} from '@/lib/deals/fees'

describe('deal fees', () => {
  test('platform fee is 1% of principal', () => {
    expect(platformFeeAmount(10_000)).toBe(100)
    expect(PLATFORM_FEE_PERCENT).toBe(1)
  })

  test('investor funding total includes platform fee', () => {
    expect(investorFundingTotal(10_000)).toBe(10_100)
    expect(investorFundingTotal(45_000)).toBe(45_450)
  })

  test('repayment escrow grosses up for platform + TW protocol fees', () => {
    expect(TW_PROTOCOL_FEE_PERCENT).toBe(0.3)
    const principal = 10_000
    const interest = 500
    const payout = investorPayoutAmount(principal, interest)
    expect(payout).toBe(10_500)

    const escrow = repaymentEscrowAmount(principal, interest)
    // 10500 / 0.987 ≈ 10638.30
    expect(escrow).toBe(10_638.3)

    const afterFees = escrow * (1 - (PLATFORM_FEE_PERCENT + TW_PROTOCOL_FEE_PERCENT) / 100)
    expect(Number(afterFees.toFixed(2))).toBe(payout)
  })

  test('handles non-positive principal', () => {
    expect(platformFeeAmount(0)).toBe(0)
    expect(investorFundingTotal(-1)).toBe(0)
    expect(repaymentEscrowAmount(0, 100)).toBe(0)
  })

  test('repayment milestone amount is a percent of grossed total', () => {
    const total = repaymentEscrowAmount(10_000, 500)
    expect(repaymentMilestoneAmount(total, 50)).toBe(5_319.15)
    expect(repaymentMilestoneAmount(total, 100)).toBe(total)
    expect(repaymentMilestoneAmount(0, 50)).toBe(0)
  })

  test('repayment remaining amount subtracts scheduled slices', () => {
    const total = repaymentEscrowAmount(10_000, 500)
    const first = repaymentMilestoneAmount(total, 50)
    expect(repaymentRemainingAmount(total, [first])).toBe(5_319.15)
    expect(repaymentRemainingAmount(total, [first, 5_319.15])).toBe(0)
    expect(repaymentRemainingAmount(total, [])).toBe(total)
  })
})
