import { describe, expect, test } from 'bun:test'
import { formatAmount, formatLocalizedDate, formatMoney } from '@/lib/i18n/format'

describe('active locale formatting', () => {
  test('the same deal keeps its cents and uses English or Spanish currency conventions', () => {
    expect(formatMoney('en', 12345.67)).toBe('$12,345.67')
    expect(formatMoney('es', 12345.67)).toBe('12.345,67\u00a0US$')
  })

  test('repayment amounts use the active locale with exactly two decimal places', () => {
    expect(formatAmount('en', 12345.6)).toBe('12,345.60')
    expect(formatAmount('es', 12345.6)).toBe('12.345,60')
    expect(formatAmount('en', 0)).toBe('0.00')
    expect(formatAmount('es', 0)).toBe('0,00')
  })

  test('dates use UTC even near a day boundary and respect the locale', () => {
    const timestamp = '2026-11-21T00:30:00Z'
    expect(formatLocalizedDate(timestamp, 'en')).toBe('11/21/2026')
    expect(formatLocalizedDate(timestamp, 'es')).toBe('21/11/2026')
    expect(formatLocalizedDate('2026-11-21', 'en')).toBe('11/21/2026')
    expect(formatLocalizedDate(timestamp, 'en', { hour: '2-digit', minute: '2-digit', hour12: false }))
      .toBe('00:30')
  })

  test('missing and invalid activity dates retain the empty placeholder', () => {
    expect(formatLocalizedDate(null, 'en')).toBe('—')
    expect(formatLocalizedDate('', 'es')).toBe('—')
    expect(formatLocalizedDate('not-a-date', 'es')).toBe('—')
  })
})
