'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from '@/components/navigation'
import { DealCard } from '@/components/deal-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildDealsBrowseUrl,
  fetchDealsBrowse,
} from '@/lib/deals/browse-client'
import {
  dealBrowseCacheKey,
  parseDealsBrowseParams,
  type DealBrowseFilters,
  type DealBrowseSort,
  type DealBrowseStatusFilter,
  type DealsBrowseResponse,
  type DealsBrowseSummary,
} from '@/lib/deals/browse'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/types'
import { X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

const STATUS_PILLS: { value: DealBrowseStatusFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'deals.allDeals' },
  { value: 'open', labelKey: 'deals.openForFunding' },
  { value: 'active', labelKey: 'deals.active' },
  { value: 'completed', labelKey: 'deals.completed' },
]

const SORT_OPTIONS: { value: DealBrowseSort; labelKey: string }[] = [
  { value: 'newest', labelKey: 'deals.newest' },
  { value: 'highest_yield', labelKey: 'deals.highestApr' },
  { value: 'highest_amount', labelKey: 'deals.highestAmount' },
  { value: 'shortest_term', labelKey: 'deals.shortestTerm' },
]

export interface DealsBrowseProps {
  /** First page rendered on the server so deals are present in the HTML. */
  initialDeals: Deal[]
  initialPage: number
  initialHasMore: boolean
  initialMatchCount: number
  initialSummary: DealsBrowseSummary
  initialCategories: string[]
  initialFilters: DealBrowseFilters
}

function formatCompact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `$${Math.round(v / 1_000)}K`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return formatCurrency(v)
}

export function DealsBrowse({
  initialDeals,
  initialPage,
  initialHasMore,
  initialMatchCount,
  initialSummary,
  initialCategories,
  initialFilters,
}: DealsBrowseProps) {
  const { t } = useI18n()

  const [searchQuery, setSearchQuery] = useState(initialFilters.q)
  const [debouncedQuery, setDebouncedQuery] = useState(initialFilters.q)
  const [statusFilter, setStatusFilter] = useState<DealBrowseStatusFilter>(
    initialFilters.status,
  )
  const [categoryFilter, setCategoryFilter] = useState<string>(
    initialFilters.category ?? 'all',
  )
  const [sortBy, setSortBy] = useState<DealBrowseSort>(initialFilters.sort)

  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [page, setPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [matchCount, setMatchCount] = useState(initialMatchCount)
  const [summary, setSummary] = useState<DealsBrowseSummary>(initialSummary)
  const [categories, setCategories] = useState<string[]>(initialCategories)
  const [isLoading, setIsLoading] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(id)
  }, [searchQuery])

  const filters = useMemo<DealBrowseFilters>(
    () => ({
      status: statusFilter,
      category: categoryFilter === 'all' ? null : categoryFilter,
      q: debouncedQuery,
      sort: sortBy,
      page: 1,
    }),
    [statusFilter, categoryFilter, debouncedQuery, sortBy],
  )

  const request = useCallback(async (next: DealBrowseFilters, append: boolean) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    try {
      const payload: DealsBrowseResponse = await fetchDealsBrowse.fetch(next)
      if (requestId !== requestIdRef.current) return
      setDeals((prev) => (append ? [...prev, ...payload.deals] : payload.deals))
      setPage(payload.page)
      setHasMore(payload.hasMore)
      setMatchCount(payload.matchCount)
      setSummary(payload.summary)
      setCategories(payload.categories)
    } catch (error) {
      console.error('Error fetching deals:', error)
      if (requestId === requestIdRef.current && !append) {
        setDeals([])
        setMatchCount(0)
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [])

  // The server already rendered the filters in `initialFilters`, so the first
  // effect run is skipped and only interactive changes sync the URL and refetch.
  const filtersKey = dealBrowseCacheKey(filters)
  const lastFiltersKeyRef = useRef(filtersKey)

  useEffect(() => {
    if (lastFiltersKeyRef.current === filtersKey) return
    lastFiltersKeyRef.current = filtersKey
    if (typeof window !== 'undefined') {
      const nextUrl = buildDealsBrowseUrl(
        window.location.pathname,
        window.location.search,
        filters,
      )
      window.history.replaceState(window.history.state, '', nextUrl)
    }
    void request(filters, false)
  }, [filters, filtersKey, request])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const params = Object.fromEntries(
        new URLSearchParams(window.location.search).entries(),
      )
      const parsed = parseDealsBrowseParams(params)
      setStatusFilter(parsed.status)
      setCategoryFilter(parsed.category ?? 'all')
      setSearchQuery(parsed.q)
      setDebouncedQuery(parsed.q)
      setSortBy(parsed.sort)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleLoadMore = useCallback(() => {
    if (isLoading) return
    void request({ ...filters, page: page + 1 }, true)
  }, [filters, isLoading, page, request])

  const hasActiveFilters =
    statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery !== ''

  const handleClearAll = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setSearchQuery('')
  }

  const pillCount = (value: DealBrowseStatusFilter): number => {
    switch (value) {
      case 'open':
        return summary.open
      case 'expired':
        return summary.expired
      case 'active':
        return summary.active
      case 'completed':
        return summary.completed
      default:
        return 0
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-10">
        {/* Page header */}
        <header className="mb-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t('deals.eyebrow')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('deals.title')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('deals.description')}
          </p>
        </header>

        {/* Summary figures — uniform ledger strip without per-stat card chrome */}
        <dl className="mb-8 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-border py-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t('deals.totalDeals')}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
              {summary.total}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t('deals.openForFunding')}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
              {summary.open}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t('deals.active')}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
              {summary.active}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t('deals.totalValue')}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
              {formatCompact(summary.totalValue)}
            </dd>
          </div>
        </dl>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Status quick-filters — single focus/active treatment */}
          <div
            className="flex flex-wrap gap-1 border-b border-border"
            role="group"
            aria-label={t('deals.filterStatusAria')}
          >
            {STATUS_PILLS.map((pill) => {
              const isSelected = statusFilter === pill.value
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  aria-pressed={isSelected}
                  className={cn(
                    'relative -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isSelected
                      ? 'border-foreground font-semibold text-foreground'
                      : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>{t(pill.labelKey)}</span>
                  {pill.value !== 'all' && (
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        isSelected
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {pillCount(pill.value)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search, category, sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 sm:max-w-sm">
              <Input
                type="search"
                placeholder={t('deals.searchPlaceholder')}
                aria-label={t('deals.searchAria')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-full sm:w-[180px]"
                aria-label={t('deals.filterCategoryAria')}
              >
                <SelectValue placeholder={t('common.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('deals.allCategories')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="capitalize">
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as DealBrowseSort)}
            >
              <SelectTrigger
                className="w-full sm:w-[180px]"
                aria-label={t('deals.filterSortAria')}
              >
                <SelectValue placeholder={t('deals.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t('common.filters')}
            </span>
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs">
                {t(
                  STATUS_PILLS.find((p) => p.value === statusFilter)
                    ?.labelKey ?? 'deals.allDeals',
                )}
                <button
                  type="button"
                  aria-label={t('deals.removeStatus')}
                  onClick={() => setStatusFilter('all')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs capitalize">
                {categoryFilter}
                <button
                  type="button"
                  aria-label={t('deals.removeCategory')}
                  onClick={() => setCategoryFilter('all')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs">
                &ldquo;{searchQuery}&rdquo;
                <button
                  type="button"
                  aria-label={t('deals.clearSearch')}
                  onClick={() => setSearchQuery('')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleClearAll}
            >
              {t('common.clearAll')}
            </Button>
          </div>
        )}

        {/* Result count — polite live region announces the new total after each
            settled filter/sort change, not on every keystroke. */}
        <p
          className="mb-4 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isLoading && deals.length === 0
            ? t('deals.loadingDeals')
            : `${matchCount} ${
                matchCount === 1 ? t('deals.dealCountOne') : t('deals.dealCountOther')
              }`}
        </p>

        {/* Invoice list */}
        {isLoading && deals.length === 0 ? (
          <div className="border-t border-border" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse border-b border-border bg-muted/20"
              />
            ))}
          </div>
        ) : deals.length > 0 ? (
          <>
            <div aria-busy={isLoading}>
              {deals.map((deal, index) => (
                <DealCard key={deal.id} deal={deal} listIndex={index} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? t('deals.loadingDeals') : t('deals.loadMore')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="border-y border-border py-16 text-center">
            <p className="mb-1 text-base font-semibold">{t('deals.noDeals')}</p>
            <p className="mx-auto mb-5 max-w-xs text-sm text-muted-foreground">
              {hasActiveFilters
                ? t('deals.noDealsFiltered')
                : t('deals.noDealsEmpty')}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={handleClearAll}>
                {t('common.clearFilters')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
