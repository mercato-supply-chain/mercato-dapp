import { describe, expect, test } from 'bun:test'
import {
  calculateYieldAPR,
  calculateYieldAmount,
  clampYieldBonusApr,
  effectiveInvestorApr,
} from '@/lib/yield'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import {
  expectedYield,
  accruedYield,
} from '@/lib/investments/portfolio-metrics'
import { platformFeeAmount, investorFundingTotal } from '@/lib/deals/fees'
import { formatUSDC } from '@/lib/format'

const TERMS = [30, 45, 60, 75, 90] as const
const AMOUNTS = [84, 1_000, 10_000, 25_000, 60_000, 120_000] as const

/** Expected base rates before volume discount (5% @ 30d → 10% @ 90d). */
const BASE_RATE_BY_TERM: Record<(typeof TERMS)[number], number> = {
  30: 5,
  45: 6.25,
  60: 7.5,
  75: 8.75,
  90: 10,
}

describe('calculateYieldAPR variants', () => {
  test('maps each term to the expected base rate for small deals', () => {
    for (const term of TERMS) {
      expect(calculateYieldAPR(term, 10_000)).toBe(BASE_RATE_BY_TERM[term])
    }
  })

  test('never exceeds 10% across all term/amount combinations', () => {
    for (const term of TERMS) {
      for (const amount of AMOUNTS) {
        const rate = calculateYieldAPR(term, amount)
        expect(rate).toBeLessThanOrEqual(10)
        expect(rate).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('applies volume discounts correctly', () => {
    expect(calculateYieldAPR(90, 10_000)).toBe(10)
    expect(calculateYieldAPR(90, 25_000)).toBe(9.5)
    expect(calculateYieldAPR(90, 60_000)).toBe(9)
    expect(calculateYieldAPR(90, 120_000)).toBe(8)
  })

  test('clamps out-of-range terms to 30–90 for rate purposes', () => {
    expect(calculateYieldAPR(1, 10_000)).toBe(5)
    expect(calculateYieldAPR(180, 10_000)).toBe(10)
  })
})

describe('calculateYieldAmount (flat rate, not annualized)', () => {
  test('earnings = amount × rate% for every term/amount variant', () => {
    for (const term of TERMS) {
      for (const amount of AMOUNTS) {
        const rate = calculateYieldAPR(term, amount)
        const earnings = calculateYieldAmount(amount, term, rate)
        const expected = Number((amount * (rate / 100)).toFixed(2))
        expect(earnings).toBe(expected)
        // Period % shown in UI must match the rate
        expect(Number(((earnings / amount) * 100).toFixed(2))).toBe(rate)
      }
    }
  })

  test('user example: $84 @ 75 days → 8.75% → $7.35', () => {
    const rate = calculateYieldAPR(75, 84)
    expect(rate).toBe(8.75)
    expect(calculateYieldAmount(84, 75, rate)).toBe(7.35)
  })

  test('user example: 8% of $84 is $6.72', () => {
    expect(calculateYieldAmount(84, 75, 8)).toBe(6.72)
  })

  test('does not annualize (no days/365 factor)', () => {
    const amount = 10_000
    const rate = 10
    // Annualized would be ~821.92 for 30 days; flat is 1000
    expect(calculateYieldAmount(amount, 30, rate)).toBe(1_000)
    expect(calculateYieldAmount(amount, 90, rate)).toBe(1_000)
  })
})

describe('computeInvestorReturns / portfolio expectedYield stay in sync', () => {
  test('matches calculateYieldAmount across variants', () => {
    for (const term of TERMS) {
      for (const amount of AMOUNTS) {
        const rate = calculateYieldAPR(term, amount)
        const fromYield = calculateYieldAmount(amount, term, rate)
        const fromReturns = computeInvestorReturns(amount, rate, term)
        const fromPortfolio = expectedYield(amount, rate, term)
        expect(fromReturns.profit).toBe(fromYield)
        expect(fromPortfolio).toBe(fromYield)
        expect(fromReturns.total).toBe(Number((amount + fromYield).toFixed(2)))
      }
    }
  })

  test('accrued yield reaches full flat yield at term end', () => {
    const amount = 1_000
    const rate = 8
    const termDays = 60
    const fundedAt = new Date(Date.now() - termDays * 86_400_000).toISOString()
    expect(accruedYield(amount, rate, fundedAt, termDays)).toBe(80)
  })
})

describe('platform fee display amounts', () => {
  test('1% of $84 is $0.84 (not rounded to $0)', () => {
    expect(platformFeeAmount(84)).toBe(0.84)
    expect(formatUSDC(platformFeeAmount(84))).toBe('$0.84')
    expect(investorFundingTotal(84)).toBe(84.84)
    expect(formatUSDC(investorFundingTotal(84))).toBe('$84.84')
  })

  test('fee stays positive for small principals', () => {
    for (const amount of [1, 10, 50, 84, 99]) {
      const fee = platformFeeAmount(amount)
      expect(fee).toBeGreaterThan(0)
      expect(formatUSDC(fee)).not.toBe('$0.00')
    }
  })
})

describe('bonus helpers still work for legacy deals', () => {
  test('clamp and effective rate', () => {
    expect(clampYieldBonusApr(12)).toBe(10)
    expect(clampYieldBonusApr(-1)).toBe(0)
    expect(effectiveInvestorApr(8.75, 1.25)).toBe(10)
  })
})
