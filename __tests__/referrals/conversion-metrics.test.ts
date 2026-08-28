import { describe, expect, test } from 'bun:test'
import { computeConversionRate } from '@/lib/referrals/invitation-metrics'

describe('conversion metrics', () => {
  test('never returns NaN or null for empty denominator', () => {
    const rate = computeConversionRate(0, 0)
    expect(rate).toBe(0)
    expect(Number.isFinite(rate)).toBe(true)
  })

  test('full conversion', () => {
    expect(computeConversionRate(10, 10)).toBe(1)
  })
})
