import { describe, expect, test } from 'bun:test'
import { dealsBrowseQueryString } from '@/lib/deals/browse-client'

describe('dealsBrowseQueryString', () => {
  test('omits default values', () => {
    expect(
      dealsBrowseQueryString({
        status: 'all',
        category: null,
        q: '',
        sort: 'newest',
        page: 1,
      }),
    ).toBe('')
  })

  test('serializes every non-default filter', () => {
    const query = dealsBrowseQueryString({
      status: 'open',
      category: 'Food & Beverage',
      q: 'coffee beans',
      sort: 'highest_amount',
      page: 3,
    })
    const params = new URLSearchParams(query)
    expect(params.get('status')).toBe('open')
    expect(params.get('category')).toBe('Food & Beverage')
    expect(params.get('q')).toBe('coffee beans')
    expect(params.get('sort')).toBe('highest_amount')
    expect(params.get('page')).toBe('3')
  })

  test('starts with a question mark when it has parameters', () => {
    expect(
      dealsBrowseQueryString({
        status: 'completed',
        category: null,
        q: '',
        sort: 'newest',
        page: 1,
      }).startsWith('?'),
    ).toBe(true)
  })
})
