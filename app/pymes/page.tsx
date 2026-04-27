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
  Store,
  Search,
  Globe,
  Briefcase,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { LATAM_COUNTRIES, SECTORS, getCountryLabel, getSectorLabel } from '@/lib/constants'
import {
  aggregateDealsToStats,
  computePymeReputation,
  type PymeReputation,
  type PymeReputationTier,
} from '@/lib/pyme-reputation'
import { ReputationTooltip } from '@/components/reputation-tooltip'

type Smb = {
  id: string
  company_name: string | null
  full_name: string | null
  contact_name: string | null
  bio: string | null
  address: string | null
  phone: string | null
  email: string
  country: string | null
  sector: string | null
  deal_count?: number
  active_deals?: number
  reputation?: PymeReputation
  reputationLabel?: string
  reputationTier?: PymeReputationTier
  totalRepaid?: number
  completionRate?: number
}

const TIER_ORDER: Record<PymeReputationTier, number> = {
  top_performer: 0,
  established: 1,
  building: 2,
  new: 3,
}

const TIER_STYLES: Record<PymeReputationTier, string> = {
  top_performer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  established: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  building: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  new: 'bg-muted text-muted-foreground',
}

function getInitials(smb: Smb): string {
  const name = smb.company_name || smb.full_name || smb.contact_name || ''
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function SmbCardSkeleton() {
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

export default function SmbsPage() {
  const supabase = createClient()
  const [smbs, setSmbs] = useState<Smb[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSmbs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSmbs = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, company_name, full_name, contact_name, bio, address, phone, email, country, sector')
        .eq('user_type', 'pyme')
        .order('company_name')

      if (error) throw error

      const ids = (profiles ?? []).map((p) => p.id)
      const { data: dealRows } = await supabase
        .from('deals')
        .select('pyme_id, status, amount')
        .in('pyme_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

      const dealsBySmb: Record<string, { status: string; amount: number }[]> = {}
      for (const p of ids) dealsBySmb[p] = []
      for (const row of dealRows ?? []) {
        const r = row as { pyme_id: string; status: string; amount: number }
        if (!dealsBySmb[r.pyme_id]) dealsBySmb[r.pyme_id] = []
        dealsBySmb[r.pyme_id].push({ status: r.status, amount: r.amount })
      }

      const enriched: Smb[] = (profiles ?? []).map((p) => {
        const deals = dealsBySmb[p.id] ?? []
        const stats = aggregateDealsToStats(deals)
        const rep = computePymeReputation(stats)
        const active_deals = deals.filter(
          (d) => d.status === 'funded' || d.status === 'in_progress'
        ).length
        return {
          ...p,
          deal_count: deals.length,
          active_deals,
          reputation: rep,
          reputationLabel: rep.label,
          reputationTier: rep.tier,
          totalRepaid: rep.stats.totalRepaid,
          completionRate: rep.completionRate,
        }
      })

      setSmbs(
        enriched.toSorted((a, b) => {
          const tierDiff =
            TIER_ORDER[a.reputationTier ?? 'new'] - TIER_ORDER[b.reputationTier ?? 'new']
          if (tierDiff !== 0) return tierDiff
          return (b.deal_count ?? 0) - (a.deal_count ?? 0)
        }),
      )
    } catch (err) {
      console.error('Error loading SMBs:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSmbs = useMemo(() => {
    let result = [...smbs]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.company_name?.toLowerCase().includes(q) ||
          p.full_name?.toLowerCase().includes(q) ||
          p.contact_name?.toLowerCase().includes(q) ||
          p.bio?.toLowerCase().includes(q)
      )
    }
    if (selectedCountry !== 'all') result = result.filter((p) => p.country === selectedCountry)
    if (selectedSector !== 'all') result = result.filter((p) => p.sector === selectedSector)
    return result
  }, [smbs, searchQuery, selectedCountry, selectedSector])

  const displayName = (p: Smb) =>
    p.company_name || p.full_name || p.contact_name || 'SMB'

  const hasActiveFilters =
    searchQuery || selectedCountry !== 'all' || selectedSector !== 'all'

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">SMB Directory</h1>
          <p className="text-muted-foreground">
            Small and medium businesses seeking supply-chain financing across LATAM
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search SMBs, company names…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search SMBs"
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
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
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
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result count */}
        {!isLoading && (
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="h-4 w-4" aria-hidden />
            <span>
              {filteredSmbs.length} {filteredSmbs.length === 1 ? 'SMB' : 'SMBs'} found
              {hasActiveFilters && ' matching your filters'}
            </span>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SmbCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredSmbs.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Store className="h-8 w-8 text-muted-foreground" aria-hidden />
            </div>
            <p className="mb-1 text-lg font-semibold">No SMBs found</p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? 'Try adjusting your search or filters' : 'No SMBs have joined yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSmbs.map((smb) => (
              <Link key={smb.id} href={`/pymes/${smb.id}`}>
                <Card className="group h-full transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader className="pb-3">
                    {/* Top row: avatar + badges */}
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-base select-none">
                        {getInitials(smb)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        {smb.reputationTier && smb.reputationTier !== 'new' && smb.reputation && (
                          <ReputationTooltip reputation={smb.reputation} side="bottom" align="end">
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${TIER_STYLES[smb.reputationTier]}`}
                              title={`Reputation: ${smb.reputationLabel}. Hover for breakdown.`}
                            >
                              {smb.reputationLabel}
                            </span>
                          </ReputationTooltip>
                        )}
                        {typeof smb.deal_count === 'number' && smb.deal_count > 0 && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                            {smb.deal_count} deal{smb.deal_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <CardTitle className="text-base leading-snug">{displayName(smb)}</CardTitle>

                    {/* Location / sector */}
                    {(smb.country || smb.sector) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {smb.sector && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3 shrink-0" aria-hidden />
                            {getSectorLabel(smb.sector)}
                          </span>
                        )}
                        {smb.country && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3 shrink-0" aria-hidden />
                            {getCountryLabel(smb.country)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bio */}
                    {smb.bio && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-snug">
                        {smb.bio}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="border-t border-border pt-3 space-y-2">
                      {/* Active deals */}
                      {typeof smb.active_deals === 'number' && smb.active_deals > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {smb.active_deals} active deal{smb.active_deals !== 1 ? 's' : ''}
                        </div>
                      )}

                      {/* Total repaid */}
                      {typeof smb.totalRepaid === 'number' && smb.totalRepaid > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 0,
                          }).format(smb.totalRepaid)}{' '}
                          repaid
                        </div>
                      )}

                      {/* Completion rate */}
                      {typeof smb.completionRate === 'number' && smb.completionRate > 0 && (
                        <div className="mt-1">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Completion rate</span>
                            <span className="font-medium tabular-nums">
                              {Math.round(smb.completionRate * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.round(smb.completionRate * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* New SMB placeholder */}
                      {(smb.deal_count ?? 0) === 0 && (
                        <p className="text-xs text-muted-foreground">No deals yet on MERCATO</p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-2 transition-all">
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
