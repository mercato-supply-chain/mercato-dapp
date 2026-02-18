'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Mail,
  Phone,
  Search,
  Wallet,
  ArrowRight,
  Globe,
  Briefcase,
} from 'lucide-react'
import { LATAM_COUNTRIES, SECTORS, getCountryLabel, getSectorLabel } from '@/lib/constants'
import {
  aggregateDealsToStats,
  computePymeReputation,
  type PymeReputationTier,
} from '@/lib/pyme-reputation'

type Pyme = {
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
  reputationLabel?: string
  reputationTier?: PymeReputationTier
  totalRepaid?: number
}

export default function PymesPage() {
  const supabase = createClient()
  const [pymes, setPymes] = useState<Pyme[]>([])
  const [filteredPymes, setFilteredPymes] = useState<Pyme[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPymes()
  }, [])

  useEffect(() => {
    filterPymes()
  }, [pymes, searchQuery, selectedCountry, selectedSector])

  const loadPymes = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, company_name, full_name, contact_name, bio, address, phone, email, country, sector')
        .eq('user_type', 'pyme')
        .order('company_name')

      if (profilesError) throw profilesError

      const ids = (profiles ?? []).map((p) => p.id)
      const { data: dealRows } = await supabase
        .from('deals')
        .select('pyme_id, status, amount')
        .in('pyme_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

      const dealsByPyme: Record<string, { status: string; amount: number }[]> = {}
      for (const p of ids) {
        dealsByPyme[p] = []
      }
      for (const row of dealRows ?? []) {
        const r = row as { pyme_id: string; status: string; amount: number }
        if (!dealsByPyme[r.pyme_id]) dealsByPyme[r.pyme_id] = []
        dealsByPyme[r.pyme_id].push({ status: r.status, amount: r.amount })
      }

      const withCountsAndReputation = (profiles ?? []).map((p) => {
        const deals = dealsByPyme[p.id] ?? []
        const deal_count = deals.length
        const stats = aggregateDealsToStats(deals)
        const rep = computePymeReputation(stats)
        return {
          ...p,
          deal_count,
          reputationLabel: rep.label,
          reputationTier: rep.tier,
          totalRepaid: rep.stats.totalRepaid,
        }
      })

      setPymes(withCountsAndReputation as Pyme[])
    } catch (error) {
      console.error('Error loading PYMEs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterPymes = () => {
    let filtered = [...pymes]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.company_name?.toLowerCase().includes(q) ||
          p.full_name?.toLowerCase().includes(q) ||
          p.contact_name?.toLowerCase().includes(q) ||
          p.bio?.toLowerCase().includes(q)
      )
    }

    if (selectedCountry !== 'all') {
      filtered = filtered.filter((p) => p.country === selectedCountry)
    }

    if (selectedSector !== 'all') {
      filtered = filtered.filter((p) => p.sector === selectedSector)
    }

    setFilteredPymes(filtered)
  }

  const displayName = (p: Pyme) =>
    p.company_name || p.full_name || p.contact_name || 'PYME'

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">PYME Directory</h1>
          <p className="text-muted-foreground">
            Small and medium businesses seeking supply-chain financing across LATAM
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search PYMEs, company names…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search PYMEs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-[160px]" aria-label="Filter by country">
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
              <SelectTrigger className="w-[180px]" aria-label="Filter by sector">
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

        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Store className="h-4 w-4" aria-hidden />
          <span>
            {filteredPymes.length} {filteredPymes.length === 1 ? 'PYME' : 'PYMEs'} found
          </span>
        </div>

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-muted-foreground">Loading PYMEs…</p>
          </div>
        ) : filteredPymes.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center">
            <Store className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
            <p className="mb-2 text-lg font-medium">No PYMEs found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPymes.map((pyme) => (
              <Link key={pyme.id} href={`/pymes/${pyme.id}`}>
                <Card className="h-full transition-colors hover:border-accent hover:bg-muted/30">
                  <CardHeader>
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Store className="h-5 w-5 text-primary" aria-hidden />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-right">
                        {pyme.reputationTier && pyme.reputationTier !== 'new' && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                              pyme.reputationTier === 'top_performer'
                                ? 'bg-success/15 text-success'
                                : pyme.reputationTier === 'established'
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {pyme.reputationLabel}
                          </span>
                        )}
                        {typeof pyme.deal_count === 'number' && pyme.deal_count > 0 && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                            {pyme.deal_count} deal{pyme.deal_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-lg">{displayName(pyme)}</CardTitle>
                    {(pyme.country || pyme.sector) && (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {pyme.sector && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {getSectorLabel(pyme.sector)}
                          </span>
                        )}
                        {pyme.country && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {getCountryLabel(pyme.country)}
                          </span>
                        )}
                      </div>
                    )}
                    {pyme.bio && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {pyme.bio}
                      </CardDescription>
                    )}
                    {typeof pyme.totalRepaid === 'number' && pyme.totalRepaid > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium text-success tabular-nums">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 0,
                          }).format(pyme.totalRepaid)}
                        </span>{' '}
                        repaid to investors
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 border-t border-border pt-3 text-sm">
                      {pyme.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="truncate">{pyme.email}</span>
                        </div>
                      )}
                      {pyme.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 shrink-0" aria-hidden />
                          <span>{pyme.phone}</span>
                        </div>
                      )}
                      {pyme.address && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Wallet className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="truncate font-mono text-xs">
                            {pyme.address.slice(0, 6)}…{pyme.address.slice(-4)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2 text-primary text-sm font-medium">
                      View profile
                      <ArrowRight className="h-4 w-4" aria-hidden />
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
