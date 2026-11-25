'use client'

import { createDedupedFetcher } from '@/lib/client/deduped-fetch'
import { dealBrowseCacheKey } from '@/lib/deals/browse'
import type { DealBrowseFilters, DealsBrowseResponse } from '@/lib/deals/browse'

/** Serialize browse filters into the `/api/deals/browse` query string. */
export function dealsBrowseQueryString(filters: DealBrowseFilters): string {
  const params = new URLSearchParams()
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  if (filters.q) params.set('q', filters.q)
  if (filters.sort !== 'newest') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))
  const query = params.toString()
  return query ? `?${query}` : ''
}

/**
 * Build the browser URL for `/deals` while preserving unrelated query
 * parameters (such as `lang`) and clearing legacy `filter` aliases.
 */
export function buildDealsBrowseUrl(
  pathname: string,
  currentSearch: string,
  filters: DealBrowseFilters,
): string {
  const params = new URLSearchParams(currentSearch)
  params.delete('filter')

  if (filters.status !== 'all') {
    params.set('status', filters.status)
  } else {
    params.delete('status')
  }

  if (filters.category) {
    params.set('category', filters.category)
  } else {
    params.delete('category')
  }

  if (filters.q) {
    params.set('q', filters.q)
  } else {
    params.delete('q')
  }

  if (filters.sort !== 'newest') {
    params.set('sort', filters.sort)
  } else {
    params.delete('sort')
  }

  if (filters.page > 1) {
    params.set('page', String(filters.page))
  } else {
    params.delete('page')
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

/**
 * Deduplicating client data layer for subsequent pages and filter changes.
 * Coalesces identical in-flight requests (React Strict Mode, fast typing) and
 * reuses recent responses briefly.
 */
export const fetchDealsBrowse = createDedupedFetcher(
  async (filters: DealBrowseFilters): Promise<DealsBrowseResponse> => {
    const response = await fetch(`/api/deals/browse${dealsBrowseQueryString(filters)}`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`Failed to load deals (${response.status})`)
    }
    return (await response.json()) as DealsBrowseResponse
  },
  (filters) => dealBrowseCacheKey(filters),
  5_000,
)
