import { describe, expect, test } from 'bun:test'
import { validateCatalogProductForDeal } from '@/lib/deals/validate-catalog-product'

const product = {
  id: 'prod-1',
  supplier_id: 'sup-1',
  name: 'Coffee beans',
  category: 'food',
  price_per_unit: 50,
  description: 'Premium beans',
  stock_quantity: 100,
  reserved_quantity: 10,
}

describe('validateCatalogProductForDeal', () => {
  test('accepts valid product with sufficient inventory', () => {
    const result = validateCatalogProductForDeal(product, 'sup-1', 50)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.unitPrice).toBe(50)
    }
  })

  test('rejects missing product', () => {
    const result = validateCatalogProductForDeal(null, 'sup-1', 10)
    expect(result).toEqual({ ok: false, error: 'Product not found' })
  })

  test('rejects product from another supplier company', () => {
    const result = validateCatalogProductForDeal(product, 'sup-other', 10)
    expect(result).toEqual({
      ok: false,
      error: 'Product does not belong to the selected supplier company',
    })
  })

  test('rejects insufficient inventory', () => {
    const result = validateCatalogProductForDeal(product, 'sup-1', 200)
    expect(result).toEqual({
      ok: false,
      error: 'Insufficient product inventory for the requested quantity',
    })
  })

  test('uses authoritative catalog unit price', () => {
    const result = validateCatalogProductForDeal(
      { ...product, price_per_unit: 42.5 },
      'sup-1',
      5,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.unitPrice).toBe(42.5)
    }
  })

  test('rejects non-integer quantity', () => {
    const result = validateCatalogProductForDeal(product, 'sup-1', 1.5)
    expect(result.ok).toBe(false)
  })
})
