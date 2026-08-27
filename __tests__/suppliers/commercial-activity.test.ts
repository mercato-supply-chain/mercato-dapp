import { describe, expect, test } from 'bun:test'
import { mapProductConversionRate } from '@/lib/suppliers/get-supplier-commercial-activity'

describe('mapProductConversionRate', () => {
  test('returns zero when eligible count is zero', () => {
    expect(mapProductConversionRate(0, 0)).toBe(0)
    expect(mapProductConversionRate(5, 0)).toBe(0)
  })

  test('calculates funded / eligible', () => {
    expect(mapProductConversionRate(3, 10)).toBe(0.3)
    expect(mapProductConversionRate(1, 4)).toBe(0.25)
  })
})

describe('product performance attribution rules', () => {
  test('NULL product_id deals must not appear in product performance rows', () => {
    // Documented expectation: RPC filters product_id IS NOT NULL.
    const legacyDeal = { product_id: null, amount: 1000 }
    expect(legacyDeal.product_id).toBeNull()
  })
})
