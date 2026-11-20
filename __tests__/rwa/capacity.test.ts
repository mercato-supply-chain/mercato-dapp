import { describe, expect, test } from 'bun:test'
import {
  buildCapacityState,
  buildContributionPreview,
  isCapacityStale,
  parseContributionInput,
  RWA_CAPACITY_STALE_MS,
  RWA_MINIMUM_CONTRIBUTION,
  validateContributionRules,
} from '@/lib/rwa'
import type { RwaCreditTerms } from '@/lib/rwa'

const baseTerms: RwaCreditTerms = {
  targetPrincipal: 1_000,
  financingTarget: 1_000,
  yieldApr: 5,
  termDays: 30,
  platformFeePercent: 1,
  fundingExpiresAt: null,
}

describe('buildCapacityState', () => {
  test('remainingCapacity = target - confirmedPrincipal', () => {
    const cap = buildCapacityState(1_000, 600)
    expect(cap.confirmedPrincipal).toBe(600)
    expect(cap.remainingCapacity).toBeCloseTo(400)
    expect(cap.targetReached).toBe(false)
  })

  test('targetReached is true when remaining is 0', () => {
    const cap = buildCapacityState(1_000, 1_000)
    expect(cap.targetReached).toBe(true)
    expect(cap.remainingCapacity).toBe(0)
  })

  test('clamps negative confirmedPrincipal to 0', () => {
    const cap = buildCapacityState(1_000, -100)
    expect(cap.confirmedPrincipal).toBe(0)
    expect(cap.remainingCapacity).toBeCloseTo(1_000)
  })

  test('remaining never goes below 0 even if overconfirmed', () => {
    const cap = buildCapacityState(1_000, 1_200)
    expect(cap.remainingCapacity).toBe(0)
  })
})

describe('isCapacityStale', () => {
  test('fresh snapshot is not stale', () => {
    const cap = buildCapacityState(1_000, 0)
    expect(isCapacityStale(cap)).toBe(false)
  })

  test('old snapshot is stale', () => {
    const cap = buildCapacityState(1_000, 0)
    // Simulate a snapshot older than RWA_CAPACITY_STALE_MS
    const oldTime = new Date(Date.now() - RWA_CAPACITY_STALE_MS - 1_000).toISOString()
    const staleCapacity = { ...cap, fetchedAt: oldTime }
    expect(isCapacityStale(staleCapacity)).toBe(true)
  })
})

describe('parseContributionInput', () => {
  test('valid integer amount', () => {
    const result = parseContributionInput('500')
    expect(result.valid).toBe(true)
    expect(result.principalRaw).toBe(500)
    expect(result.error).toBeNull()
  })

  test('valid decimal amount', () => {
    const result = parseContributionInput('123.456')
    expect(result.valid).toBe(true)
    expect(result.principalRaw).toBeCloseTo(123.456)
  })

  test('empty string returns empty error', () => {
    const result = parseContributionInput('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('empty')
  })

  test('whitespace-only returns empty error', () => {
    const result = parseContributionInput('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('empty')
  })

  test('letters returns invalid_format', () => {
    const result = parseContributionInput('abc')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid_format')
  })

  test('negative number returns invalid_format', () => {
    const result = parseContributionInput('-100')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid_format')
  })

  test('zero returns invalid_format', () => {
    const result = parseContributionInput('0')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid_format')
  })

  test('more than 7 decimal places returns too_many_decimals', () => {
    const result = parseContributionInput('1.12345678') // 8 decimal places
    expect(result.valid).toBe(false)
    expect(result.error).toBe('too_many_decimals')
  })

  test('exactly 7 decimal places is valid', () => {
    const result = parseContributionInput('1.1234567')
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  test('amount with leading whitespace is trimmed and accepted', () => {
    const result = parseContributionInput('  250  ')
    expect(result.valid).toBe(true)
    expect(result.principalRaw).toBe(250)
  })
})

describe('validateContributionRules', () => {
  const freshCapacity = buildCapacityState(1_000, 0)

  test('valid amount within capacity and balance passes', () => {
    const error = validateContributionRules(400, freshCapacity, 500)
    expect(error).toBeNull()
  })

  test('amount exceeding remaining capacity returns exceeds_capacity', () => {
    const partialCap = buildCapacityState(1_000, 700)
    // Remaining = 300; trying to contribute 400
    const error = validateContributionRules(400, partialCap, 500)
    expect(error).toBe('exceeds_capacity')
  })

  test('amount exceeding wallet balance returns exceeds_balance', () => {
    // fundingTotal for 400 principal = 404 (400 + 1%)
    const error = validateContributionRules(400, freshCapacity, 400)
    // wallet has 400, but needs 404 total → exceeds_balance
    expect(error).toBe('exceeds_balance')
  })

  test('stale capacity returns capacity_stale regardless of amount', () => {
    const oldTime = new Date(Date.now() - RWA_CAPACITY_STALE_MS - 1_000).toISOString()
    const staleCapacity = { ...freshCapacity, fetchedAt: oldTime }
    const error = validateContributionRules(100, staleCapacity, 10_000)
    expect(error).toBe('capacity_stale')
  })

  test('target already reached returns exceeds_capacity', () => {
    const fullCap = buildCapacityState(1_000, 1_000)
    const error = validateContributionRules(1, fullCap, 10_000)
    expect(error).toBe('exceeds_capacity')
  })

  test('amount below minimum returns below_minimum', () => {
    const error = validateContributionRules(
      RWA_MINIMUM_CONTRIBUTION / 10,
      freshCapacity,
      10_000,
    )
    expect(error).toBe('below_minimum')
  })
})

describe('buildContributionPreview', () => {
  const freshCapacity = buildCapacityState(1_000, 0)

  test('preview computes correct fee and total debit', () => {
    const preview = buildContributionPreview(400, baseTerms, freshCapacity)
    expect(preview.principalRaw).toBe(400)
    expect(preview.platformFeeAmount).toBeCloseTo(4) // 1% of 400
    expect(preview.totalWalletDebit).toBeCloseTo(404)
  })

  test('shareOfTarget is contribution / target', () => {
    const preview = buildContributionPreview(600, baseTerms, freshCapacity)
    expect(preview.shareOfTarget).toBeCloseTo(0.6)
  })

  test('fillsTarget is true when contribution equals remaining capacity', () => {
    const preview = buildContributionPreview(1_000, baseTerms, freshCapacity)
    expect(preview.fillsTarget).toBe(true)
    expect(preview.remainingAfter).toBe(0)
  })

  test('fillsTarget is false for a partial contribution', () => {
    const preview = buildContributionPreview(400, baseTerms, freshCapacity)
    expect(preview.fillsTarget).toBe(false)
    expect(preview.remainingAfter).toBeCloseTo(600)
  })

  test('partial fill: remaining capacity decreases by contribution amount', () => {
    const partialCap = buildCapacityState(1_000, 300) // 700 remaining
    const preview = buildContributionPreview(200, baseTerms, partialCap)
    expect(preview.remainingAfter).toBeCloseTo(500) // 700 - 200
  })

  test('estimated return is computed from contribution principal, not full deal amount', () => {
    // 600 USDC at 5% APR, 30 days: yield = 600 * 0.05 = 30
    const preview = buildContributionPreview(600, baseTerms, freshCapacity)
    expect(preview.estimatedReturnAmount).toBeCloseTo(30)
    expect(preview.estimatedPayoutAtMaturity).toBeCloseTo(630)
  })
})
