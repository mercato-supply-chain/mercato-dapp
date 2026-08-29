import { describe, expect, test } from 'bun:test'
import { buildSupplierActivityHref } from '@/lib/suppliers/supplier-activity-url'

describe('buildSupplierActivityHref', () => {
  test('returns the bare path when there are no filters and page is 1', () => {
    expect(buildSupplierActivityHref({}, 1)).toBe('/dashboard/supplier-activity')
  })

  test('omits the page param when page is 1', () => {
    expect(buildSupplierActivityHref({ company: 'company-1' }, 1)).toBe(
      '/dashboard/supplier-activity?company=company-1',
    )
  })

  test('includes the page param when page is greater than 1', () => {
    expect(buildSupplierActivityHref({}, 2)).toBe('/dashboard/supplier-activity?page=2')
  })

  test('includes only truthy filter values, in insertion order', () => {
    const href = buildSupplierActivityHref(
      {
        company: 'company-1',
        product: undefined,
        category: 'Textiles',
        status: '',
        dateFrom: '2026-01-01',
        dateTo: undefined,
      },
      3,
    )
    expect(href).toBe(
      '/dashboard/supplier-activity?company=company-1&category=Textiles&dateFrom=2026-01-01&page=3',
    )
  })
})
