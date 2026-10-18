'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from '@/components/navigation'
import { DealCard } from '@/components/deal-card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchDealsBrowse } from '@/lib/deals/browse-client'
import {
  dealBrowseCacheKey,
  type DealBrowseFilters,
  type DealBrowseSort,
  type DealBrowseStatusFilter,
  type DealsBrowseResponse,
  type DealsBrowseSummary,
} from '@/lib/deals/browse'
import { formatCurrency } from '@/lib/format'
import type { Deal } from '@/lib/types'
import { Search, TrendingUp, BarChart3, Clock, DollarSign, X } from 'lucide-react'
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
  const [statusFilter, setStatusFilter] = useState<DealBrowseStatusFilter>(initialFilters.status)
  const [categoryFilter, setCategoryFilter] = useState<string>(initialFilters.category ?? 'all')
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
      const payload: DealsBrowseResponse = await fetchDealsBrowse(next)
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
  // effect run is skipped and only interactive changes refetch.
  const filtersKey = dealBrowseCacheKey(filters)
  const lastFiltersKeyRef = useRef(filtersKey)

  useEffect(() => {
    if (lastFiltersKeyRef.current === filtersKey) return
    lastFiltersKeyRef.current = filtersKey
    void request(filters, false)
  }, [filters, filtersKey, request])

  const loadMore = useCallback(() => {
    if (isLoading) return
    void request({ ...filters, page: page + 1 }, true)
  }, [filters, isLoading, page, request])

  const hasActiveFilters =
    statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery !== ''

  const clearAll = () => {
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
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent ring-1 ring-accent/20">
            <TrendingUp className="h-3 w-3" aria-hidden />
            {t('deals.eyebrow')}
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">{t('deals.title')}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {t('deals.description')}
          </p>
        </div>

        {/* Stat tiles */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('deals.totalDeals')}</p>
              <p className="text-2xl font-bold tabular-nums">{summary.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <TrendingUp className="h-5 w-5 text-accent" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('deals.openForFunding')}</p>
              <p className="text-2xl font-bold tabular-nums text-accent">{summary.open}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-success/30 bg-success/5 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Clock className="h-5 w-5 text-success" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('deals.active')}</p>
              <p className="text-2xl font-bold tabular-nums text-success">{summary.active}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <DollarSign className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('deals.totalValue')}</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatCompact(summary.totalValue)}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Status quick-filter pills */}
          <div className="flex flex-wrap gap-2">
            {STATUS_PILLS.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setStatusFilter(pill.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 ${
                  statusFilter === pill.value
                    ? 'bg-foreground text-background'
                    : 'border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {t(pill.labelKey)}
                {pill.value !== 'all' && (
                  <Badge
                    variant="secondary"
                    className={`h-4 min-w-4 px-1 py-0 text-[10px] tabular-nums ${
                      statusFilter === pill.value ? 'bg-background/20 text-background' : ''
                    }`}
                  >
                    {pillCount(pill.value)}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Search, category, sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder={t('deals.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
              <SelectTrigger className="w-full sm:w-[180px]">
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
            <span className="text-xs text-muted-foreground">{t('common.filters')}</span>
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                {t(STATUS_PILLS.find((p) => p.value === statusFilter)?.labelKey ?? 'deals.allDeals')}
                <button
                  type="button"
                  aria-label={t('deals.removeStatus')}
                  onClick={() => setStatusFilter('all')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium capitalize">
                {categoryFilter}
                <button
                  type="button"
                  aria-label={t('deals.removeCategory')}
                  onClick={() => setCategoryFilter('all')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                &ldquo;{searchQuery}&rdquo;
                <button
                  type="button"
                  aria-label={t('deals.clearSearch')}
                  onClick={() => setSearchQuery('')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
              {t('common.clearAll')}
            </Button>
          </div>
        )}

        {/* Result count */}
        <p className="mb-4 text-sm text-muted-foreground">
          {isLoading && deals.length === 0
            ? t('deals.loadingDeals')
            : `${matchCount} ${
                matchCount === 1 ? t('deals.dealCountOne') : t('deals.dealCountOther')
              }`}
        </p>

        {/* Deal grid */}
        {isLoading && deals.length === 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl border-2 border-border bg-muted/40"
              />
            ))}
          </div>
        ) : deals.length > 0 ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal, index) => (
                <DealCard key={deal.id} deal={deal} listIndex={index} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={isLoading}>
                  {isLoading ? t('deals.loadingDeals') : t('deals.loadMore')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="mb-1 text-base font-semibold">{t('deals.noDeals')}</p>
            <p className="mb-5 max-w-xs text-sm text-muted-foreground">
              {hasActiveFilters ? t('deals.noDealsFiltered') : t('deals.noDealsEmpty')}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearAll}>
                {t('common.clearFilters')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
