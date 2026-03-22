'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Mail,
  Search,
  ArrowRight,
  Globe,
  Briefcase,
  PieChart,
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
  total_invested: number
}

export default function InvestorsPage() {
  const supabase = createClient()
  const [investors, setInvestors] = useState<Investor[]>([])
  const [filtered, setFiltered] = useState<Investor[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadInvestors()
  }, [])

  useEffect(() => {
    filterInvestors()
  }, [investors, searchQuery, selectedCountry, selectedSector])

  const loadInvestors = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(
          'id, company_name, full_name, contact_name, bio, email, country, sector, verified',
        )
        .eq('user_type', 'investor')
        .order('company_name')

      if (profilesError) throw profilesError

      const ids = (profiles ?? []).map((p) => p.id)
      const { data: dealRows } =
        ids.length > 0
          ? await supabase
              .from('deals')
              .select('investor_id, amount')
              .in('investor_id', ids)
          : { data: [] as { investor_id: string; amount: number }[] }

      const stats: Record<string, { count: number; total: number }> = {}
      for (const row of dealRows ?? []) {
        if (!row.investor_id) continue
        if (!stats[row.investor_id]) {
          stats[row.investor_id] = { count: 0, total: 0 }
        }
        stats[row.investor_id].count += 1
        stats[row.investor_id].total += Number(row.amount ?? 0)
      }

      const enriched: Investor[] = (profiles ?? []).map((p) => {
        const s = stats[p.id] ?? { count: 0, total: 0 }
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
          total_invested: s.total,
        }
      })

      setInvestors(enriched)
    } catch (e) {
      console.error(e)
      setInvestors([])
    } finally {
      setIsLoading(false)
    }
  }

  const filterInvestors = () => {
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

    if (selectedCountry !== 'all') {
      list = list.filter((inv) => inv.country === selectedCountry)
    }

    if (selectedSector !== 'all') {
      list = list.filter((inv) => inv.sector === selectedSector)
    }

    setFiltered(list)
  }

  const displayName = (inv: Investor) =>
    inv.company_name || inv.full_name || inv.contact_name || 'Investor'

  const formatUsd = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            Investor directory
          </h1>
          <p className="text-muted-foreground">
            Active capital partners funding supply-chain deals on MERCATO
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 md:max-w-md">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
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
          <PieChart className="h-4 w-4" aria-hidden />
          <span>
            {filtered.length}{' '}
            {filtered.length === 1 ? 'investor' : 'investors'} found
          </span>
        </div>

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-muted-foreground">Loading investors…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center">
            <TrendingUp
              className="mb-4 h-12 w-12 text-muted-foreground"
              aria-hidden
            />
            <p className="mb-2 text-lg font-medium">No investors found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((inv) => (
              <Link key={inv.id} href={`/investors/${inv.id}`}>
                <Card className="h-full transition-colors hover:border-accent hover:bg-muted/30">
                  <CardHeader>
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                        <TrendingUp
                          className="h-5 w-5 text-success"
                          aria-hidden
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {inv.verified && (
                          <Badge
                            variant="secondary"
                            className="bg-success/10 text-success"
                          >
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
                    <CardTitle className="text-lg">{displayName(inv)}</CardTitle>
                    {(inv.country || inv.sector) && (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {inv.sector && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {getSectorLabel(inv.sector)}
                          </span>
                        )}
                        {inv.country && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {getCountryLabel(inv.country)}
                          </span>
                        )}
                      </div>
                    )}
                    {inv.bio && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {inv.bio}
                      </CardDescription>
                    )}
                    {inv.total_invested > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium text-success tabular-nums">
                          {formatUsd(inv.total_invested)}
                        </span>{' '}
                        deployed on-platform
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {inv.email && (
                      <div className="space-y-2 border-t border-border pt-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="truncate">{inv.email}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2 text-sm font-medium text-primary">
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
