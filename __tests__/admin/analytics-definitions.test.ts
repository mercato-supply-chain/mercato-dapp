import { describe, expect, test } from 'bun:test'
import {
  conversionRate,
  pctChange,
  previousPeriod,
  resolveRange,
} from '@/lib/admin/analytics-definitions'

const NOW = new Date('2026-08-24T15:30:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

describe('resolveRange', () => {
  test('today starts at UTC midnight and ends now', () => {
    const range = resolveRange('today', null, null, NOW)
    expect(range.key).toBe('today')
    expect(range.from.toISOString()).toBe('2026-08-24T00:00:00.000Z')
    expect(range.to.toISOString()).toBe(NOW.toISOString())
  })

  test.each([
    ['7d', 7],
    ['30d', 30],
    ['90d', 90],
  ] as const)('%s covers the trailing window', (key, days) => {
    const range = resolveRange(key, null, null, NOW)
    expect(range.key).toBe(key)
    expect(range.to.getTime() - range.from.getTime()).toBe(days * DAY_MS)
    expect(range.to.toISOString()).toBe(NOW.toISOString())
  })

  test('unknown keys fall back to 30d', () => {
    expect(resolveRange('yearly', null, null, NOW).key).toBe('30d')
    expect(resolveRange(null, null, null, NOW).key).toBe('30d')
  })

  test('custom range is inclusive of the end day (UTC)', () => {
    const range = resolveRange('custom', '2026-08-01', '2026-08-15', NOW)
    expect(range.key).toBe('custom')
    expect(range.from.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-08-16T00:00:00.000Z')
  })

  test('invalid or inverted custom input falls back to 30d', () => {
    expect(resolveRange('custom', '2026-08-15', '2026-08-01', NOW).key).toBe('30d')
    expect(resolveRange('custom', 'nope', '2026-08-01', NOW).key).toBe('30d')
    expect(resolveRange('custom', null, null, NOW).key).toBe('30d')
  })
})

describe('previousPeriod', () => {
  test('returns the equally long window immediately before', () => {
    const range = resolveRange('7d', null, null, NOW)
    const prev = previousPeriod(range)
    expect(prev.to.toISOString()).toBe(range.from.toISOString())
    expect(prev.to.getTime() - prev.from.getTime()).toBe(7 * DAY_MS)
  })

  test('works for the partial today window', () => {
    const range = resolveRange('today', null, null, NOW)
    const prev = previousPeriod(range)
    expect(prev.to.toISOString()).toBe(range.from.toISOString())
    expect(prev.to.getTime() - prev.from.getTime()).toBe(
      range.to.getTime() - range.from.getTime(),
    )
  })
})

describe('pctChange', () => {
  test('computes growth and decline', () => {
    expect(pctChange(150, 100)).toBe(50)
    expect(pctChange(50, 100)).toBe(-50)
  })

  test('null when previous is zero or missing', () => {
    expect(pctChange(10, 0)).toBeNull()
    expect(pctChange(10, null)).toBeNull()
    expect(pctChange(null, 10)).toBeNull()
  })

  test('handles negative previous values via absolute base', () => {
    expect(pctChange(-50, -100)).toBe(50)
  })
})

describe('conversionRate', () => {
  test('computes percentage of a cohort', () => {
    expect(conversionRate(25, 100)).toBe(25)
  })

  test('null for empty cohorts', () => {
    expect(conversionRate(5, 0)).toBeNull()
    expect(conversionRate(5, null)).toBeNull()
    expect(conversionRate(null, 10)).toBeNull()
  })
})
