import { describe, expect, it } from 'bun:test'
import { parseFile } from '@/lib/supplier-profile/inventory-import-parser'

describe('inventory-import parser bundle isolation', () => {
  it('does not load xlsx into module cache when parsing CSV', async () => {
    const csvContent = 'name,category,price_per_unit\nTest Product,Hardware,25.00'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

    const result = await parseFile(file)
    expect(result.ok).toBe(true)

    // Verify xlsx has not been imported into node/bun module cache
    const cacheKeys = Object.keys(require.cache || {})
    const xlsxLoaded = cacheKeys.some((k) => k.toLowerCase().includes('xlsx') && !k.includes('inventory-import-isolation'))
    expect(xlsxLoaded).toBe(false)
  })
})
