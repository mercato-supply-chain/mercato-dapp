import { describe, expect, test } from 'bun:test'
import {
  displayToRawAmount,
  parseRawTokenAmount,
  parseVaultBalancePayload,
  rawToDisplayAmount,
  sumUnderlyingDisplayAmounts,
} from '@/lib/defindex/amounts'

describe('rawToDisplayAmount', () => {
  test('divides raw units by 10^decimals (default 7)', () => {
    expect(rawToDisplayAmount(10_000_000)).toBe(1)
    expect(rawToDisplayAmount(1_234_567)).toBeCloseTo(0.1234567, 10)
  })

  test('honors an explicit decimals argument', () => {
    expect(rawToDisplayAmount(1_000_000, 6)).toBe(1)
    expect(rawToDisplayAmount(100, 2)).toBe(1)
  })

  test('accepts string raw units', () => {
    expect(rawToDisplayAmount('10000000')).toBe(1)
    expect(rawToDisplayAmount('1001', 7)).toBeCloseTo(0.0001001, 10)
  })

  test('returns 0 for non-finite input', () => {
    expect(rawToDisplayAmount('not-a-number')).toBe(0)
    expect(rawToDisplayAmount(Number.NaN)).toBe(0)
    expect(rawToDisplayAmount(Number.POSITIVE_INFINITY)).toBe(0)
  })

  test('is the inverse of displayToRawAmount for round values', () => {
    expect(rawToDisplayAmount(displayToRawAmount(42.5))).toBe(42.5)
  })
})

describe('displayToRawAmount', () => {
  test('multiplies by 10^decimals and rounds (default 7)', () => {
    expect(displayToRawAmount(1)).toBe(10_000_000)
    expect(displayToRawAmount(0.0001001)).toBe(1001)
  })

  test('honors an explicit decimals argument', () => {
    expect(displayToRawAmount(1, 6)).toBe(1_000_000)
  })

  test('rounds to the nearest raw unit', () => {
    expect(displayToRawAmount(0.00000005, 7)).toBe(1)
    expect(displayToRawAmount(0.00000004, 7)).toBe(0)
  })

  test('returns 0 for non-positive or non-finite input', () => {
    expect(displayToRawAmount(0)).toBe(0)
    expect(displayToRawAmount(-5)).toBe(0)
    expect(displayToRawAmount(Number.NaN)).toBe(0)
  })
})

describe('parseRawTokenAmount', () => {
  test('passes through finite numbers', () => {
    expect(parseRawTokenAmount(1234)).toBe(1234)
  })

  test('parses numeric strings and trims whitespace', () => {
    expect(parseRawTokenAmount(' 42 ')).toBe(42)
  })

  test('returns 0 for empty, non-numeric, or unsupported values', () => {
    expect(parseRawTokenAmount('')).toBe(0)
    expect(parseRawTokenAmount('abc')).toBe(0)
    expect(parseRawTokenAmount(null)).toBe(0)
    expect(parseRawTokenAmount({})).toBe(0)
  })
})

describe('sumUnderlyingDisplayAmounts', () => {
  test('sums per-asset raw amounts as display values', () => {
    expect(sumUnderlyingDisplayAmounts([10_000_000, 5_000_000])).toBe(1.5)
  })

  test('skips non-positive and non-finite entries', () => {
    expect(sumUnderlyingDisplayAmounts([10_000_000, 0, -1, Number.NaN])).toBe(1)
  })

  test('returns 0 for an empty list', () => {
    expect(sumUnderlyingDisplayAmounts([])).toBe(0)
  })
})

describe('parseVaultBalancePayload', () => {
  test('normalizes camelCase payloads', () => {
    const parsed = parseVaultBalancePayload({
      dfTokens: '10000000',
      underlyingBalance: ['10000000', '10000000'],
    })
    expect(parsed.dfTokensRaw).toBe(10_000_000)
    expect(parsed.underlyingRawPerAsset).toEqual([10_000_000, 10_000_000])
    expect(parsed.underlyingTotalRaw).toBe(20_000_000)
    expect(parsed.underlyingTotalDisplay).toBe(2)
  })

  test('normalizes snake_case payloads', () => {
    const parsed = parseVaultBalancePayload({
      df_tokens: 10_000_000,
      underlying_balance: [10_000_000],
    })
    expect(parsed.dfTokensRaw).toBe(10_000_000)
    expect(parsed.underlyingTotalDisplay).toBe(1)
  })

  test('falls back to dfTokens when underlying is missing right after a deposit', () => {
    const parsed = parseVaultBalancePayload({ dfTokens: 10_000_000 })
    expect(parsed.underlyingRawPerAsset).toEqual([10_000_000])
    expect(parsed.underlyingTotalRaw).toBe(10_000_000)
    expect(parsed.underlyingTotalDisplay).toBe(1)
  })

  test('returns zeros for empty or invalid payloads', () => {
    const parsed = parseVaultBalancePayload(null)
    expect(parsed.dfTokensRaw).toBe(0)
    expect(parsed.underlyingRawPerAsset).toEqual([])
    expect(parsed.underlyingTotalRaw).toBe(0)
    expect(parsed.underlyingTotalDisplay).toBe(0)
  })
})
