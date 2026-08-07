'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
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
  Building2,
  Search,
  Package,
  Globe,
  CheckCircle2,
  X,
} from 'lucide-react'
import { LATAM_COUNTRIES, SECTORS, getCountryLabel, getSectorLabel } from '@/lib/constants'
import { PRODUCT_CATEGORIES, getLocalizedCategoryLabel } from '@/lib/categories'
import { useI18n } from '@/lib/i18n/provider'
import type { Supplier } from '@/lib/suppliers/directory-utils'
import { useSuppliersDirectoryFilters } from '@/hooks/use-suppliers-directory-filters'
import { SupplierDirectoryCard } from '@/components/suppliers/supplier-directory-card'

const FILTER_CATEGORY_VALUES = ['all', ...PRODUCT_CATEGORIES.map((c) => c.value)] as const

type SuppliersDirectoryProps = {
  initialSuppliers: Supplier[]
}

export default function SuppliersDirectory({ initialSuppliers }: SuppliersDirectoryProps) {
  const { t, messages } = useI18n()
  const countryLabel = (code: string) =>
    messages.geo.countries[code as keyof typeof messages.geo.countries] ?? getCountryLabel(code)
  const sectorLabel = (code: string) =>
    messages.geo.sectors[code as keyof typeof messages.geo.sectors] ?? getSectorLabel(code)
  const categoryLabel = (value: string) => getLocalizedCategoryLabel(value, messages)

  const [suppliers] = useState<Supplier[]>(initialSuppliers)

  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedCountry,
    setSelectedCountry,
    selectedSector,
    setSelectedSector,
    filteredSuppliers,
    stats,
    hasActiveFilters,
    clearAll,
  } = useSuppliersDirectoryFilters(suppliers)

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
            <Building2 className="h-3 w-3" aria-hidden />
            {t('suppliersPage.eyebrow')}
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">{t('suppliersPage.title')}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t('suppliersPage.description')}</p>
        </div>

        {/* Stat tiles */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('suppliersPage.totalSuppliers')}</p>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-success/30 bg-success/5 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('suppliersPage.verified')}</p>
              <p className="text-2xl font-bold tabular-nums text-success">{stats.verified}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Globe className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('suppliersPage.countries')}</p>
              <p className="text-2xl font-bold tabular-nums">{stats.countries}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            {FILTER_CATEGORY_VALUES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-foreground text-background'
                    : 'border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {cat === 'all' ? t('suppliersPage.categories.all') : categoryLabel(cat)}
              </button>
            ))}
          </div>

          {/* Search + dropdowns */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder={t('suppliersPage.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-full sm:w-[160px]" aria-label={t('suppliersPage.filterCountryAria')}>
                <SelectValue placeholder={t('suppliersPage.countryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('suppliersPage.allCountries')}</SelectItem>
                {LATAM_COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {countryLabel(c.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-full sm:w-[180px]" aria-label={t('suppliersPage.filterSectorAria')}>
                <SelectValue placeholder={t('suppliersPage.sectorPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('suppliersPage.allSectors')}</SelectItem>
                {SECTORS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {sectorLabel(s.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('suppliersPage.filtersLabel')}</span>
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium capitalize">
                {selectedCategory === 'all'
                  ? t('suppliersPage.categories.all')
                  : categoryLabel(selectedCategory)}
                <button
                  type="button"
                  aria-label={t('suppliersPage.removeCategoryFilter')}
                  onClick={() => setSelectedCategory('all')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedCountry !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                {countryLabel(selectedCountry)}
                <button
                  type="button"
                  aria-label={t('suppliersPage.removeCountryFilter')}
                  onClick={() => setSelectedCountry('all')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedSector !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                {sectorLabel(selectedSector)}
                <button
                  type="button"
                  aria-label={t('suppliersPage.removeSectorFilter')}
                  onClick={() => setSelectedSector('all')}
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
                  aria-label={t('suppliersPage.clearSearchAria')}
                  onClick={() => setSearchQuery('')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
              {t('suppliersPage.clearAll')}
            </Button>
          </div>
        )}

        {/* Result count */}
        <p className="mb-4 text-sm text-muted-foreground">
          {filteredSuppliers.length}{' '}
          {filteredSuppliers.length === 1
            ? t('suppliersPage.supplierOne')
            : t('suppliersPage.supplierMany')}
        </p>

        {/* Grid */}
        {filteredSuppliers.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="mb-1 text-base font-semibold">{t('suppliersPage.noResultsTitle')}</p>
            <p className="mb-5 max-w-xs text-sm text-muted-foreground">
              {suppliers.length === 0 ? t('suppliersPage.noResultsEmpty') : t('suppliersPage.noResultsFiltered')}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearAll}>
                {t('suppliersPage.clearFilters')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((supplier) => (
              <SupplierDirectoryCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {suppliers.length > 0 && (
          <div className="mt-10 flex justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" aria-hidden />
              <span>
                {t('suppliersPage.bottomCtaPrefix')}{' '}
                <Link href="/create-deal" className="font-medium text-foreground underline-offset-4 hover:underline">
                  {t('suppliersPage.bottomCtaLink')}
                </Link>{' '}
                {t('suppliersPage.bottomCtaSuffix')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
