'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  Search,
  Globe,
  Briefcase,
  ArrowRight,
  CheckCircle2,
  Activity,
} from 'lucide-react'
import { LATAM_COUNTRIES, SECTORS, getCountryLabel, getSectorLabel } from '@/lib/constants'

type Investor = {
  id: string
  company_name: string | null
  full_name: string | null
  contact_name: string | null
  bio: string | null
  email: string
  country: string | null
  sector: string | null
  verified: boolean
  deal_count: number
  active_deals: number
  completed_deals: number
  total_invested: number
}

function getInitials(inv: Investor): string {
  const name = inv.company_name || inv.full_name || inv.contact_name || ''
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

function InvestorCardSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardHeader>
        <div className="mb-3 flex items-start justify-between">
          <div className="h-12 w-12 rounded-xl bg-muted" />
          <div className="h-5 w-20 rounded-md bg-muted" />
        </div>
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-2 h-3 w-28 rounded bg-muted" />
        <div className="mt-2 h-3 w-full rounded bg-muted" />
        <div className="mt-1 h-3 w-3/4 rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="border-t border-border pt-3 space-y-2">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function InvestorsPage() {
  const supabase = createClient()
  const [investors, setInvestors] = useState<Investor[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadInvestors()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadInvestors = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, company_name, full_name, contact_name, bio, email, country, sector, verified')
        .eq('user_type', 'investor')
        .order('company_name')

      if (error) throw error

      const ids = (profiles ?? []).map((p) => p.id)
      const { data: dealRows } =
        ids.length > 0
          ? await supabase
              .from('deals')
              .select('investor_id, amount, status')
              .in('investor_id', ids)
          : { data: [] as { investor_id: string; amount: number; status: string }[] }

      const stats: Record<string, { count: number; active: number; completed: number; total: number }> = {}
      for (const row of dealRows ?? []) {
        if (!row.investor_id) continue
        if (!stats[row.investor_id]) stats[row.investor_id] = { count: 0, active: 0, completed: 0, total: 0 }
        stats[row.investor_id].count += 1
        stats[row.investor_id].total += Number(row.amount ?? 0)
        if (row.status === 'funded' || row.status === 'in_progress') stats[row.investor_id].active += 1
        if (row.status === 'completed') stats[row.investor_id].completed += 1
      }

      const enriched: Investor[] = (profiles ?? []).map((p) => {
        const s = stats[p.id] ?? { count: 0, active: 0, completed: 0, total: 0 }
        return {
          id: p.id,
          company_name: p.company_name,
          full_name: p.full_name,
          contact_name: p.contact_name,
          bio: p.bio,
          email: p.email,
          country: p.country,
          sector: p.sector,
          verified: p.verified ?? false,
          deal_count: s.count,
          active_deals: s.active,
          completed_deals: s.completed,
          total_invested: s.total,
        }
      })

      setInvestors(
        enriched.toSorted((a, b) => {
          if (a.verified !== b.verified) return a.verified ? -1 : 1
          return b.total_invested - a.total_invested
        }),
      )
    } catch (e) {
      console.error(e)
      setInvestors([])
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let list = [...investors]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (inv) =>
          inv.company_name?.toLowerCase().includes(q) ||
          inv.full_name?.toLowerCase().includes(q) ||
          inv.contact_name?.toLowerCase().includes(q) ||
          inv.bio?.toLowerCase().includes(q),
      )
    }
    if (selectedCountry !== 'all') list = list.filter((inv) => inv.country === selectedCountry)
    if (selectedSector !== 'all') list = list.filter((inv) => inv.sector === selectedSector)
    return list
  }, [investors, searchQuery, selectedCountry, selectedSector])

  const displayName = (inv: Investor) =>
    inv.company_name || inv.full_name || inv.contact_name || 'Investor'

  const hasActiveFilters = searchQuery || selectedCountry !== 'all' || selectedSector !== 'all'

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Investor Directory</h1>
          <p className="text-muted-foreground">
            Active capital partners funding supply-chain deals on MERCATO
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search investors, companies…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search investors"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by country">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {LATAM_COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-[160px]" aria-label="Filter by sector">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sectors</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result count */}
        {!isLoading && (
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" aria-hidden />
            <span>
              {filtered.length} {filtered.length === 1 ? 'investor' : 'investors'} found
              {hasActiveFilters && ' matching your filters'}
            </span>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <InvestorCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="h-8 w-8 text-muted-foreground" aria-hidden />
            </div>
            <p className="mb-1 text-lg font-semibold">No investors found</p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? 'Try adjusting your search or filters' : 'No investors have joined yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((inv) => (
              <Link key={inv.id} href={`/investors/${inv.id}`}>
                <Card className="group h-full transition-all duration-200 hover:border-emerald-400/60 hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader className="pb-3">
                    {/* Top row */}
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-base select-none">
                        {getInitials(inv)}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {inv.verified && (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                        {inv.deal_count > 0 && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                            {inv.deal_count} deal{inv.deal_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <CardTitle className="text-base leading-snug">{displayName(inv)}</CardTitle>

                    {/* Location / sector */}
                    {(inv.country || inv.sector) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {inv.sector && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3 shrink-0" aria-hidden />
                            {getSectorLabel(inv.sector)}
                          </span>
                        )}
                        {inv.country && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3 shrink-0" aria-hidden />
                            {getCountryLabel(inv.country)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bio */}
                    {inv.bio && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-snug">
                        {inv.bio}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="border-t border-border pt-3 space-y-2">
                      {/* Total deployed */}
                      {inv.total_invested > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {formatUsd(inv.total_invested)} deployed
                        </div>
                      )}

                      {/* Active deals */}
                      {inv.active_deals > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {inv.active_deals} active deal{inv.active_deals !== 1 ? 's' : ''}
                        </div>
                      )}

                      {/* Completed */}
                      {inv.completed_deals > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {inv.completed_deals} completed
                        </div>
                      )}

                      {inv.deal_count === 0 && (
                        <p className="text-xs text-muted-foreground">No deals funded yet</p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 group-hover:gap-2 transition-[gap] duration-200">
                      View profile
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
