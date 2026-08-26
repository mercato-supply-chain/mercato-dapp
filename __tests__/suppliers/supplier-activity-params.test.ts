import { describe, expect, test } from 'bun:test'
import { parseSupplierActivityParams } from '@/lib/suppliers/supplier-activity-params'

describe('parseSupplierActivityParams', () => {
  test('returns undefined fields and page 1 for an empty params object', () => {
    const result = parseSupplierActivityParams({})
    expect(result).toEqual({
      companyId: undefined,
      productId: undefined,
      category: undefined,
      commercialStatus: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      dateFromISO: undefined,
      dateToISO: undefined,
      page: 1,
    })
  })

  test('trims and passes through company, product, and category', () => {
    const result = parseSupplierActivityParams({
      company: '  company-1  ',
      product: '  product-1  ',
      category: '  Textiles  ',
    })
    expect(result.companyId).toBe('company-1')
    expect(result.productId).toBe('product-1')
    expect(result.category).toBe('Textiles')
  })

  test('treats blank strings as undefined', () => {
    const result = parseSupplierActivityParams({ company: '   ', product: '' })
    expect(result.companyId).toBeUndefined()
    expect(result.productId).toBeUndefined()
  })

  test('accepts a valid commercial status', () => {
    const result = parseSupplierActivityParams({ status: 'needs_shipment' })
    expect(result.commercialStatus).toBe('needs_shipment')
  })

  test('rejects an invalid commercial status', () => {
    const result = parseSupplierActivityParams({ status: 'not-a-real-status' })
    expect(result.commercialStatus).toBeUndefined()
  })

  test('converts date range to start/end-of-day ISO instants while keeping raw values', () => {
    const result = parseSupplierActivityParams({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    expect(result.dateFrom).toBe('2026-01-01')
    expect(result.dateTo).toBe('2026-01-31')
    expect(result.dateFromISO).toBe('2026-01-01T00:00:00.000Z')
    expect(result.dateToISO).toBe('2026-01-31T23:59:59.999Z')
  })

  test('clamps page to a minimum of 1', () => {
    expect(parseSupplierActivityParams({ page: '0' }).page).toBe(1)
    expect(parseSupplierActivityParams({ page: '-5' }).page).toBe(1)
  })

  test('falls back to page 1 for a non-numeric page', () => {
    expect(parseSupplierActivityParams({ page: 'abc' }).page).toBe(1)
  })

  test('parses a valid page number', () => {
    expect(parseSupplierActivityParams({ page: '3' }).page).toBe(3)
  })
})
