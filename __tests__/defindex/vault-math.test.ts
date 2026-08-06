import { describe, expect, test } from 'bun:test'
import { parsePositiveAmount, projectedEarnings } from '@/lib/defindex/vault-math'

describe('parsePositiveAmount', () => {
  test('parses a plain positive number', () => {
    expect(parsePositiveAmount('10')).toBe(10)
  })
  test('accepts comma as decimal separator', () => {
    expect(parsePositiveAmount('1,5')).toBe(1.5)
  })
  test('trims whitespace', () => {
    expect(parsePositiveAmount('  20  ')).toBe(20)
  })
  test('rejects empty string', () => {
    expect(parsePositiveAmount('')).toBeNull()
  })
  test('rejects zero', () => {
    expect(parsePositiveAmount('0')).toBeNull()
  })
  test('rejects negative numbers', () => {
    expect(parsePositiveAmount('-5')).toBeNull()
  })
  test('rejects non-numeric input', () => {
    expect(parsePositiveAmount('abc')).toBeNull()
  })
  test('only replaces the first comma (documents current behavior)', () => {
    expect(parsePositiveAmount('1,234,56')).toBeNull()
  })
})

describe('projectedEarnings', () => {
  test('computes yearly as simple interest on apy percentage', () => {
    const { yearly } = projectedEarnings(1000, 5)
    expect(yearly).toBe(50)
  })
  test('computes monthly as yearly / 12', () => {
    const { monthly, yearly } = projectedEarnings(1000, 12)
    expect(monthly).toBe(yearly / 12)
  })
  test('returns zero when apy is zero', () => {
    expect(projectedEarnings(1000, 0)).toEqual({ monthly: 0, yearly: 0 })
  })
  test('returns zero when amount is zero', () => {
    expect(projectedEarnings(0, 5)).toEqual({ monthly: 0, yearly: 0 })
  })
})
