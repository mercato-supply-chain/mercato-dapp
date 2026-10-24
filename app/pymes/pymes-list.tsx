'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { LATAM_COUNTRIES, SECTORS, getCountryLabel, getSectorLabel } from '@/lib/constants'
import { useI18n } from '@/lib/i18n/provider'
import type { PymeReputation, PymeReputationTier } from '@/lib/pyme-reputation'
import { ReputationTooltip } from '@/components/reputation-tooltip'
import { VerifiedBadge } from '@/components/verified-badge'
import { Button } from '@/components/ui/button'

export type Smb = {
  id: string
  company_name: string | null
  full_name: string | null
  contact_name: string | null
  bio: string | null
  country: string | null
  sector: string | null
  verified: boolean
  deal_count: number
  active_deals: number
  reputation: PymeReputation
  reputationTier: PymeReputationTier
  totalRepaid: number
  completionRate: number
}

export type PymesFacets = {
  countries: Record<string, number>
  sectors: Record<string, number>
}

export type PymesPageResult = {
  items: Smb[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  facets: PymesFacets
}

const TIER_STYLES: Record<PymeReputationTier, string> = {
  top_performer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  established: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  building: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  new: 'bg-muted text-muted-foreground',
}

const TIER_TITLE_KEY: Record<PymeReputationTier, string> = {
  new: 'tierNew',
  building: 'tierBuilding',
  established: 'tierEstablished',
  top_performer: 'tierTopPerformer',
}

function getInitials(smb: Smb): string {
  const name = smb.company_name || smb.full_name || smb.contact_name || ''
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export function PymesList({
  initialResult,
  initialSearchQuery = '',
  initialCountry = 'all',
  initialSector = 'all',
  initialPage = 1,
}: {
  initialResult: PymesPageResult
  initialSearchQuery?: string
  initialCountry?: string
  initialSector?: string
  initialPage?: number
}) {
  const { t, messages, locale } = useI18n()
  const countryLabel = (code: string) =>
    messages.geo.countries[code as keyof typeof messages.geo.countries] ?? getCountryLabel(code)
  const sectorLabel = (code: string) =>
    messages.geo.sectors[code as keyof typeof messages.geo.sectors] ?? getSectorLabel(code)
  const fmtUsd = (value: number) =>
    new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [selectedCountry, setSelectedCountry] = useState<string>(initialCountry)
  const [selectedSector, setSelectedSector] = useState<string>(initialSector)
  const [page, setPage] = useState(initialPage)
  const [result, setResult] = useState<PymesPageResult>(initialResult)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildQuery = useCallback(
    (overrides: {
      q?: string
      country?: string
      sector?: string
      page?: number
    }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      const q = overrides.q ?? searchQuery
      const country = overrides.country ?? selectedCountry
      const sector = overrides.sector ?? selectedSector
      const nextPage = overrides.page ?? page
      if (q) params.set('q', q)
      else params.delete('q')
      if (country && country !== 'all') params.set('country', country)
      else params.delete('country')
      if (sector && sector !== 'all') params.set('sector', sector)
      else params.delete('sector')
      if (nextPage > 1) params.set('page', String(nextPage))
      else params.delete('page')
      return params.toString()
    },
    [searchParams, searchQuery, selectedCountry, selectedSector, page],
  )

  const fetchPage = useCallback(
    async (overrides: { q?: string; country?: string; sector?: string; page?: number }) => {
      setIsPending(true)
      setError(null)
      try {
        const qs = buildQuery(overrides)
        const res = await fetch(`/api/pymess${qs ? `?${qs}` : ''}`, {
          headers: { accept: 'application/json' },
        })
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data = (await res.json()) as PymesPageResult
        setResult(data)
        setPage(data.page)
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setIsPending(false)
      }
    },
    [buildQuery, pathname, router],
  )

  const filteredSmbs = result.items

  const displayName = (p: Smb) =>
    p.company_name || p.full_name || p.contact_name || t('pymesPage.smbFollback')

  const hasActiveFilters = Boolean(searchQuery) || selectedCountry !== 'all' || selectedSector !== 'all'
  const totalPages = Math.max(1, result.totalPages)
  const canPrev = page > 1 && !isPending
  const canNext = page < totalPages && !isPending

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    void fetchPage({ q: value, page: 1 })
  }

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value)
    void fetchPage({ country: value, page: 1 })
  }

  const handleSectorChange = (value: string) => {
    setSelectedSector(value)
    void fetchPage({ sector: value, page: 1 })
  }

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return
    void fetchPage({ page: nextPage })
  }

  // Debounce the live-region count so a screen reader hears one settled
  // announcement per filter change instead of one per keystroke.
  const [announceCount, setAnnounceCount] = useState(filteredSmbs.length)
  useEffect(() => {
    const id = setTimeout(() => setAnnounceCount(filteredSmbs.length), 300)
    return () => clearTimeout(id)
  }, [filteredSmbs.length])
  const announceText =
    announceCount === 1
      ? t('pymesPage.foundOne', { count: announceCount })
      : t('pymesPage.foundMany', { count: announceCount })

  return (
    <>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder={t('pymesPage.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
              aria-label={t('pymesPage.searchAria')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedCountry} onValueChange={handleCountryChange}>
              <SelectTrigger className="w-[150px]" aria-label={t('pymesPage.filterCountryAria')}>
                <SelectValue placeholder={t('pymesPage.countryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pymesPage.allCountries')}</SelectItem>
                {LATAM_COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {countryLabel(c.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSector} onValueChange={handleSectorChange}>
              <SelectTrigger className="w-[160px]" aria-label={t('pymesPage.filterSectorAria')}>
                <SelectValue placeholder={t('pymesPage.sectorPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pymesPage.allSectors')}</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {sectorLabel(s.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result count — visible count updates per keystroke for sighted
            users; a sibling sr-only live region announces the debounced
            settled count so screen readers aren't spammed. */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Store className="h-4 w-4" aria-hidden />
          <span>
            {result.total === 1
              ? t('pymesPage.foundOne', { count: result.total })
              : t('pymesPage.foundMany', { count: result.total })}
            {hasActiveFilters && t('pymesPage.matchingFilters')}
          </span>
        </div>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announceText}
        </span>

        {error && (
          <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Grid */}
        {filteredSmbs.length === 0 && !isPending ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Store className="h-8 w-8 text-muted-foreground" aria-hidden />
            </div>
            <p className="mb-1 text-lg font-semibold">{t('pymesPage.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? t('pymesPage.emptyHint') : t('pymesPage.emptyNoJoined')}
            </p>
          </div>
        ) : filteredSmbs.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSmbs.map((smb) => (
              <Link key={smb.id} href={`/pymes/${smb.id}`}>
                <Card className="group h-full transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader className="pb-3">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-base select-none">
                        {getInitials(smb)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        {smb.verified && (
                          <VerifiedBadge
                            variant="badge"
                            label={t('common.verified')}
                            tooltip={t('common.verifiedCompanyTooltip')}
                          />
                        )}
                        {smb.reputationTier !== 'new' && (
                          <ReputationTooltip reputation={smb.reputation} side="bottom" align="end">
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${TIER_STYLES[smb.reputationTier]}`}
                            >
                              {t(`pymesPage.${TIER_TITLE_KEY[smb.reputationTier]}`)}
                            </span>
                          </ReputationTooltip>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-lg">{displayName(smb)}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}
    </>
  )
}
