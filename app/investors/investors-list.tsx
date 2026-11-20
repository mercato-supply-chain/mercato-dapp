'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
import { useI18n } from '@/lib/i18n/provider'

export type Investor = {
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

export function InvestorsList({ initialInvestors }: { initialInvestors: Investor[] }) {
  const { t, messages } = useI18n()
  const countryLabel = (code: string) =>
    messages.geo.countries[code as keyof typeof messages.geo.countries] ?? getCountryLabel(code)
  const sectorLabel = (code: string) =>
    messages.geo.sectors[code as keyof typeof messages.geo.sectors] ?? getSectorLabel(code)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [selectedSector, setSelectedSector] = useState<string>('all')

  const filtered = useMemo(() => {
    let list = [...initialInvestors]
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
  }, [initialInvestors, searchQuery, selectedCountry, selectedSector])

  const displayName = (inv: Investor) =>
    inv.company_name || inv.full_name || inv.contact_name || t('investorsPage.investorFallback')

  const hasActiveFilters = searchQuery || selectedCountry !== 'all' || selectedSector !== 'all'

  // Debounce the live-region count so a screen reader hears one settled
  // announcement per filter change instead of one per keystroke.
  const [announceCount, setAnnounceCount] = useState(filtered.length)
  useEffect(() => {
    const id = setTimeout(() => setAnnounceCount(filtered.length), 300)
    return () => clearTimeout(id)
  }, [filtered.length])
  const announceText =
    announceCount === 1
      ? t('investorsPage.foundOne', { count: announceCount })
      : t('investorsPage.foundMany', { count: announceCount })

  return (
    <>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder={t('investorsPage.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label={t('investorsPage.searchAria')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-[150px]" aria-label={t('investorsPage.filterCountryAria')}>
                <SelectValue placeholder={t('investorsPage.countryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('investorsPage.allCountries')}</SelectItem>
                {LATAM_COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{countryLabel(c.value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-[160px]" aria-label={t('investorsPage.filterSectorAria')}>
                <SelectValue placeholder={t('investorsPage.sectorPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('investorsPage.allSectors')}</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{sectorLabel(s.value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result count — visible count updates per keystroke for sighted
            users; a sibling sr-only live region announces the debounced
            settled count so screen readers aren't spammed. */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" aria-hidden />
          <span>
            {filtered.length === 1
              ? t('investorsPage.foundOne', { count: filtered.length })
              : t('investorsPage.foundMany', { count: filtered.length })}
            {hasActiveFilters && t('investorsPage.matchingFilters')}
          </span>
        </div>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announceText}
        </span>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="h-8 w-8 text-muted-foreground" aria-hidden />
            </div>
            <p className="mb-1 text-lg font-semibold">{t('investorsPage.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? t('investorsPage.emptyAdjustSearch') : t('investorsPage.emptyNoJoined')}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((inv) => (
              <Link key={inv.id} href={`/investors/${inv.id}`}>
                <Card className="group h-full transition-all duration-200 hover:border-emerald-400/60 hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader className="pb-3">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-base select-none">
                        {getInitials(inv)}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {inv.verified && (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('investorsPage.verified')}
                          </Badge>
                        )}
                        {inv.deal_count > 0 && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                            {inv.deal_count}{' '}
                            {inv.deal_count === 1 ? t('deals.dealCountOne') : t('deals.dealCountOther')}
                          </span>
                        )}
                      </div>
                    </div>

                    <CardTitle className="text-base leading-snug">{displayName(inv)}</CardTitle>

                    {(inv.country || inv.sector) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {inv.sector && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3 shrink-0" aria-hidden />
                            {sectorLabel(inv.sector)}
                          </span>
                        )}
                        {inv.country && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3 shrink-0" aria-hidden />
                            {countryLabel(inv.country)}
                          </span>
                        )}
                      </div>
                    )}

                    {inv.bio && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-snug">
                        {inv.bio}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="border-t border-border pt-3 space-y-2">
                      {inv.total_invested > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {formatUsd(inv.total_invested)} {t('investorsPage.deployedSuffix')}
                        </div>
                      )}
                      {inv.active_deals > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {inv.active_deals === 1
                            ? t('investorsPage.activeDealOne', { count: inv.active_deals })
                            : t('investorsPage.activeDealMany', { count: inv.active_deals })}
                        </div>
                      )}
                      {inv.completed_deals > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {t('investorsPage.completedShort', { count: inv.completed_deals })}
                        </div>
                      )}
                      {inv.deal_count === 0 && (
                        <p className="text-xs text-muted-foreground">{t('investorsPage.noDealsFundedYet')}</p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 group-hover:gap-2 transition-[gap] duration-200">
                      {t('investorsPage.viewProfile')}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
    </>
  )
}
