'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
import { mapDealFromDb, type DealRow } from '@/lib/deals'
import { formatCurrency } from '@/lib/format'
import type { Deal } from '@/lib/types'
import { Search, TrendingUp, BarChart3, Clock, DollarSign, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

type StatusQuickFilter =
  | 'all'
  | 'open'
  | 'extended'
  | 'expired'
  | 'funded'
  | 'active'
  | 'completed'
type SortOption = 'newest' | 'highest_yield' | 'highest_amount' | 'shortest_term'

const STATUS_PILLS: { value: StatusQuickFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'deals.allDeals' },
  { value: 'awaiting_funding', labelKey: 'deals.openForFunding' },
  { value: 'active', labelKey: 'deals.active' },
  { value: 'completed', labelKey: 'deals.completed' },
]

function formatCompact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `$${Math.round(v / 1_000)}K`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return formatCurrency(v)
}

function matchesStatusFilter(deal: Deal, filter: StatusQuickFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'open') return deal.fundingStatus === 'open'
  if (filter === 'extended') return deal.fundingStatus === 'extended'
  if (filter === 'expired') return deal.fundingStatus === 'expired'
  if (filter === 'funded') return deal.fundingStatus === 'funded'
  if (filter === 'active') {
    return ['funded', 'in_progress', 'milestone_pending'].includes(deal.status)
  }
  if (filter === 'completed') return ['completed', 'released'].includes(deal.status)
  return true
}

export function DealsBrowse() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusQuickFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [deals, setDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const filter = searchParams.get('filter')
    if (filter === 'awaiting_funding') setStatusFilter('open')
    else if (filter === 'expired') setStatusFilter('expired')
    else if (filter === 'funded' || filter === 'in_progress') setStatusFilter('active')
    else if (filter === 'completed') setStatusFilter('completed')
  }, [searchParams])

  useEffect(() => {
    const supabase = createClient()
    const fetchDeals = async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(
          `
          *,
          milestones(*),
          pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name)
        `
        )
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Error fetching deals:', error)
        setDeals([])
      } else {
        const rows = (data ?? []) as DealRow[]
        setDeals(rows.map(mapDealFromDb))
      }
      setIsLoading(false)
    }
    fetchDeals()
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(deals.map((d) => d.category).filter(Boolean))).sort(),
    [deals]
  )

  const stats = useMemo(
    () => ({
      total: deals.length,
      open: deals.filter((d) => d.fundingStatus === 'open' || d.fundingStatus === 'extended').length,
      expired: deals.filter((d) => d.fundingStatus === 'expired').length,
      active: deals.filter((d) =>
        ['funded', 'in_progress', 'milestone_pending'].includes(d.status)
      ).length,
      totalValue: deals.reduce((sum, d) => sum + d.priceUSDC, 0),
    }),
    [deals]
  )

  const filteredDeals = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filtered = deals.filter((deal) => {
      if (
        q &&
        !deal.productName.toLowerCase().includes(q) &&
        !deal.pymeName.toLowerCase().includes(q) &&
        !deal.supplier.toLowerCase().includes(q)
      )
        return false
      if (!matchesStatusFilter(deal, statusFilter)) return false
      if (categoryFilter !== 'all' && deal.category !== categoryFilter) return false
      return true
    })

    return filtered.slice().sort((a, b) => {
      if (sortBy === 'highest_yield') {
        return (b.yieldAPR ?? 0) - (a.yieldAPR ?? 0)
      }
      if (sortBy === 'highest_amount') {
        return b.priceUSDC - a.priceUSDC
      }
      if (sortBy === 'shortest_term') {
        return a.term - b.term
      }
      // newest (default): already sorted by created_at desc from the query
      return 0
    })
  }, [deals, searchQuery, statusFilter, categoryFilter, sortBy])

  const hasActiveFilters =
    statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery !== ''

  const clearAll = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setSearchQuery('')
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
              <p className="text-2xl font-bold tabular-nums">
                {isLoading ? '—' : stats.total}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <TrendingUp className="h-5 w-5 text-accent" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('deals.openForFunding')}</p>
              <p className="text-2xl font-bold tabular-nums text-accent">
                {isLoading ? '—' : stats.open}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-success/30 bg-success/5 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Clock className="h-5 w-5 text-success" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('deals.active')}</p>
              <p className="text-2xl font-bold tabular-nums text-success">
                {isLoading ? '—' : stats.active}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <DollarSign className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('deals.totalValue')}</p>
              <p className="text-2xl font-bold tabular-nums">
                {isLoading ? '—' : formatCompact(stats.totalValue)}
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
                {pill.value !== 'all' && !isLoading && (
                  <Badge
                    variant="secondary"
                    className={`h-4 min-w-4 px-1 py-0 text-[10px] tabular-nums ${
                      statusFilter === pill.value ? 'bg-background/20 text-background' : ''
                    }`}
                  >
                    {pill.value === 'open'
                      ? stats.open
                      : pill.value === 'expired'
                        ? stats.expired
                      : pill.value === 'active'
                        ? stats.active
                        : deals.filter((d) =>
                            matchesStatusFilter(d, pill.value)
                          ).length}
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
                  <SelectItem key={cat} value={cat as string} className="capitalize">
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('deals.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('deals.newest')}</SelectItem>
                <SelectItem value="highest_yield">{t('deals.highestApr')}</SelectItem>
                <SelectItem value="highest_amount">{t('deals.highestAmount')}</SelectItem>
                <SelectItem value="shortest_term">{t('deals.shortestTerm')}</SelectItem>
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
          {isLoading
            ? t('deals.loadingDeals')
            : `${filteredDeals.length} ${
                filteredDeals.length === 1
                  ? t('deals.dealCountOne')
                  : t('deals.dealCountOther')
              }`}
        </p>

        {/* Deal grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl border-2 border-border bg-muted/40"
              />
            ))}
          </div>
        ) : filteredDeals.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDeals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} listIndex={index} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="mb-1 text-base font-semibold">{t('deals.noDeals')}</p>
            <p className="mb-5 max-w-xs text-sm text-muted-foreground">
              {deals.length === 0
                ? t('deals.noDealsEmpty')
                : t('deals.noDealsFiltered')}
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
