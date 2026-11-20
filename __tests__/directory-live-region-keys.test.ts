import { describe, expect, test } from 'bun:test'

const REQUIRED_KEYS: Record<string, string[]> = {
  deals: ['searchAria', 'filterStatusAria', 'filterCategoryAria', 'filterSortAria'],
  suppliersPage: ['searchAria', 'categoryGroupAria'],
}

describe('new a11y label keys resolve in both locales', () => {
  for (const [ns, keys] of Object.entries(REQUIRED_KEYS)) {
    for (const key of keys) {
      test(`${ns}.${key} present in en and es dictionaries`, async () => {
        const en = (await import('@/messages/en.json')).default as Record<
          string,
          Record<string, string>
        >
        const es = (await import('@/messages/es.json')).default as Record<
          string,
          Record<string, string>
        >
        expect(typeof en[ns]?.[key]).toBe('string')
        expect(en[ns]?.[key]?.length).toBeGreaterThan(0)
        expect(typeof es[ns]?.[key]).toBe('string')
        expect(es[ns]?.[key]?.length).toBeGreaterThan(0)
      })
    }
  }
})
