import { describe, expect, test } from 'bun:test'
import {
  DEALS_BROWSE_SELECT,
  DEALS_PAGE_SIZE,
  dealBrowseCacheKey,
  dealsBrowseFilterClauses,
  dealsBrowseFilterExpression,
  dealsBrowseRange,
  dealsSearchClause,
  dealsStatusFilterClauses,
  dealsSummaryStatusClauses,
  parseDealsBrowseParams,
  sanitizeSearchTerm,
} from '@/lib/deals/browse'

const NOW = '2026-09-25T06:00:00.000Z'

describe('DEALS_BROWSE_SELECT', () => {
  test('does not use wildcard selections', () => {
    expect(DEALS_BROWSE_SELECT).not.toContain('*')
    expect(DEALS_BROWSE_SELECT).not.toContain('milestones(*)')
  })

  test('selects exactly the explicit columns the list needs', () => {
    for (const column of [
      'id',
      'pyme_id',
      'investor_id',
      'product_id',
      'product_name',
      'amount',
      'interest_rate',
      'yield_bonus_apr',
      'supplier_name',
      'term_days',
      'status',
      'category',
      'description',
      'created_at',
      'funded_at',
      'funding_expires_at',
      'extension_count',
    ]) {
      expect(DEALS_BROWSE_SELECT).toContain(column)
    }
    expect(DEALS_BROWSE_SELECT).toContain(
      'pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name, stake_amount)',
    )
    expect(DEALS_BROWSE_SELECT).toContain(
      'milestones(id, title, percentage, status, completed_at)',
    )
  })
})

describe('parseDealsBrowseParams', () => {
  test('defaults to the first page with no filters', () => {
    expect(parseDealsBrowseParams({})).toEqual({
      status: 'all',
      category: null,
      q: '',
      sort: 'newest',
      page: 1,
    })
  })

  test('maps the legacy ?filter= values onto status filters', () => {
    expect(parseDealsBrowseParams({ filter: 'awaiting_funding' }).status).toBe('open')
    expect(parseDealsBrowseParams({ filter: 'completed' }).status).toBe('completed')
    expect(parseDealsBrowseParams({ filter: 'in_progress' }).status).toBe('active')
  })

  test('accepts direct status values', () => {
    expect(parseDealsBrowseParams({ status: 'expired' }).status).toBe('expired')
    expect(parseDealsBrowseParams({ status: 'extended' }).status).toBe('extended')
  })

  test('rejects unknown status and sort values', () => {
    const parsed = parseDealsBrowseParams({ status: 'nope', sort: 'nope', page: '-4' })
    expect(parsed.status).toBe('all')
    expect(parsed.sort).toBe('newest')
    expect(parsed.page).toBe(1)
  })

  test('trims the category and query, and parses the page number', () => {
    const parsed = parseDealsBrowseParams({
      category: '  Textiles  ',
      q: '  coffee  ',
      page: '3',
    })
    expect(parsed.category).toBe('Textiles')
    expect(parsed.q).toBe('coffee')
    expect(parsed.page).toBe(3)
  })

  test('treats a blank category as no category', () => {
    expect(parseDealsBrowseParams({ category: '   ' }).category).toBeNull()
  })
})

describe('dealsBrowseRange', () => {
  test('returns one extra row so the caller can detect the next page', () => {
    expect(dealsBrowseRange(1)).toEqual({ from: 0, to: DEALS_PAGE_SIZE })
  })

  test('offsets by page size', () => {
    expect(dealsBrowseRange(3)).toEqual({
      from: DEALS_PAGE_SIZE * 2,
      to: DEALS_PAGE_SIZE * 3,
    })
  })

  test('clamps invalid page numbers to the first page', () => {
    expect(dealsBrowseRange(0)).toEqual({ from: 0, to: DEALS_PAGE_SIZE })
    expect(dealsBrowseRange(Number.NaN)).toEqual({ from: 0, to: DEALS_PAGE_SIZE })
  })
})

describe('dealsStatusFilterClauses', () => {
  test('open requires an uninvested, unextended deal inside its funding window', () => {
    const clauses = dealsStatusFilterClauses('open', NOW)
    expect(clauses).toContain('status.eq.seeking_funding')
    expect(clauses).toContain('investor_id.is.null')
    expect(clauses).toContain('funded_at.is.null')
    expect(clauses).toContain('extension_count.eq.0')
    expect(clauses.some((clause) => clause.includes(`funding_expires_at.gt.${NOW}`))).toBe(true)
  })

  test('extended keeps the funding window check but requires extensions', () => {
    const clauses = dealsStatusFilterClauses('extended', NOW)
    expect(clauses).toContain('extension_count.gt.0')
    expect(clauses).not.toContain('extension_count.eq.0')
  })

  test('expired requires a closed funding window', () => {
    const clauses = dealsStatusFilterClauses('expired', NOW)
    expect(clauses).toContain(`funding_expires_at.lte.${NOW}`)
    expect(clauses).toContain('funding_expires_at.not.is.null')
  })

  test('active and completed map to explicit database statuses', () => {
    expect(dealsStatusFilterClauses('active', NOW)).toEqual(['status.in.(funded,in_progress)'])
    expect(dealsStatusFilterClauses('completed', NOW)).toEqual(['status.in.(completed,cancelled)'])
  })

  test('all produces no clauses', () => {
    expect(dealsStatusFilterClauses('all', NOW)).toEqual([])
  })
})

describe('dealsSummaryStatusClauses', () => {
  test('open for the stat tile also counts extended deals', () => {
    const clauses = dealsSummaryStatusClauses('open', NOW)
    expect(clauses).toContain('status.eq.seeking_funding')
    expect(clauses).not.toContain('extension_count.eq.0')
  })

  test('active and completed mirror the list filters', () => {
    expect(dealsSummaryStatusClauses('active', NOW)).toEqual(['status.in.(funded,in_progress)'])
    expect(dealsSummaryStatusClauses('completed', NOW)).toEqual([
      'status.in.(completed,cancelled)',
    ])
  })
})

describe('sanitizeSearchTerm', () => {
  test('strips PostgREST control characters', () => {
    expect(sanitizeSearchTerm('a,b(c)*d%e\\f"g')).toBe('a b c d e f g')
  })

  test('collapses whitespace and trims', () => {
    expect(sanitizeSearchTerm('  coffee   beans  ')).toBe('coffee beans')
  })
})

describe('dealsSearchClause', () => {
  test('returns null for an empty term', () => {
    expect(dealsSearchClause('')).toBeNull()
    expect(dealsSearchClause('   ')).toBeNull()
  })

  test('searches the fields shown on the cards', () => {
    const clause = dealsSearchClause('coffee')
    expect(clause).not.toBeNull()
    expect(clause!).toContain('product_name.ilike.*coffee*')
    expect(clause!).toContain('title.ilike.*coffee*')
    expect(clause!).toContain('supplier_name.ilike.*coffee*')
    expect(clause!).not.toContain('pyme_id.in.')
  })

  test('adds the resolved PyME profile ids', () => {
    const clause = dealsSearchClause('cafetal', ['pyme-1', 'pyme-2'])
    expect(clause!).toContain('pyme_id.in.(pyme-1,pyme-2)')
  })
})

describe('dealsBrowseFilterClauses', () => {
  const filters = {
    status: 'active' as const,
    category: null,
    q: 'coffee',
    sort: 'newest' as const,
    page: 1,
  }

  test('combines the status and search clauses', () => {
    const clauses = dealsBrowseFilterClauses(filters, NOW, ['pyme-1'])
    expect(clauses).toContain('status.in.(funded,in_progress)')
    expect(clauses.some((clause) => clause.startsWith('or('))).toBe(true)
  })
})

describe('dealsBrowseFilterExpression', () => {
  test('returns null when there is nothing to filter', () => {
    expect(dealsBrowseFilterExpression([])).toBeNull()
  })

  test('passes a single plain clause through', () => {
    expect(dealsBrowseFilterExpression(['status.in.(funded,in_progress)'])).toBe(
      'status.in.(funded,in_progress)',
    )
  })

  test('unwraps a lone or group so it is not nested twice', () => {
    expect(dealsBrowseFilterExpression(['or(product_name.ilike.*x*,title.ilike.*x*)'])).toBe(
      'product_name.ilike.*x*,title.ilike.*x*',
    )
  })

  test('ands multiple clauses together', () => {
    expect(
      dealsBrowseFilterExpression(['status.eq.seeking_funding', 'or(a.is.null,a.gt.1)']),
    ).toBe('and(status.eq.seeking_funding,or(a.is.null,a.gt.1))')
  })
})

describe('dealBrowseCacheKey', () => {
  test('changes for every page and filter combination', () => {
    const base = { status: 'all' as const, category: null, q: '', sort: 'newest' as const, page: 1 }
    expect(dealBrowseCacheKey(base)).toBe('all|||newest|1')
    expect(dealBrowseCacheKey({ ...base, page: 2 })).not.toBe(dealBrowseCacheKey(base))
    expect(dealBrowseCacheKey({ ...base, q: 'coffee' })).not.toBe(dealBrowseCacheKey(base))
    expect(dealBrowseCacheKey({ ...base, category: 'Textiles' })).not.toBe(
      dealBrowseCacheKey(base),
    )
  })
})
