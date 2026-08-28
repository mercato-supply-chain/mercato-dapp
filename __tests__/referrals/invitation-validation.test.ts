import { describe, expect, test } from 'bun:test'
import {
  computeConversionRate,
  isInvitationActive,
  isValidInvitationForConversion,
} from '@/lib/referrals/invitation-metrics'

describe('invitation validation metrics', () => {
  test('isInvitationActive requires active status and unexpired', () => {
    const now = Date.parse('2026-01-15T12:00:00Z')
    expect(isInvitationActive('active', null, now)).toBe(true)
    expect(isInvitationActive('active', '2026-01-16T00:00:00Z', now)).toBe(true)
    expect(isInvitationActive('active', '2026-01-10T00:00:00Z', now)).toBe(false)
    expect(isInvitationActive('revoked', null, now)).toBe(false)
    expect(isInvitationActive('converted', null, now)).toBe(false)
  })

  test('valid invitation denominator excludes revoked', () => {
    expect(isValidInvitationForConversion('active')).toBe(true)
    expect(isValidInvitationForConversion('converted')).toBe(true)
    expect(isValidInvitationForConversion('expired')).toBe(true)
    expect(isValidInvitationForConversion('revoked')).toBe(false)
  })

  test('computeConversionRate returns 0 when denominator is 0', () => {
    expect(computeConversionRate(5, 0)).toBe(0)
    expect(Number.isNaN(computeConversionRate(5, 0))).toBe(false)
  })

  test('computeConversionRate rounds to four decimal places', () => {
    expect(computeConversionRate(1, 3)).toBe(0.3333)
  })
})
