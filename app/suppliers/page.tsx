'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { Badge } from '@/components/ui/badge'
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
  Mail,
  Search,
  Package,
  ArrowRight,
  Globe,
  Briefcase,
  CheckCircle2,
  X,
} from 'lucide-react'
import { LATAM_COUNTRIES, SECTORS, getCountryLabel, getSectorLabel } from '@/lib/constants'

type Supplier = {
  id: string
  company_name: string
  bio: string | null
  address: string | null
  phone: string | null
  email: string
  categories: string[] | null
  products: string[] | null
  verified: boolean
  country: string | null
  sector: string | null
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'textiles', label: 'Textiles' },
  { value: 'food', label: 'Food' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'construction', label: 'Construction' },
  { value: 'other', label: 'Other' },
]

export default function SuppliersPage() {
  const supabase = createClient()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [selectedSector, setSelectedSector] = useState('all')

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const { data: companies, error } = await supabase
          .from('supplier_companies')
          .select('id, company_name, bio, address, phone, verified, country, sector, owner_id')
          .order('company_name')

        if (error) throw error

        const companyIds = (companies ?? []).map((c) => c.id)
        const ownerIds = [...new Set((companies ?? []).map((c) => c.owner_id).filter(Boolean))]

        const [profilesRes, productsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email')
            .in('id', ownerIds.length ? ownerIds : ['00000000-0000-0000-0000-000000000000']),
          companyIds.length > 0
            ? supabase
                .from('supplier_products')
                .select('supplier_id, name, category')
                .in('supplier_id', companyIds)
            : Promise.resolve({ data: [] as { supplier_id: string; name: string; category: string }[] }),
        ])

        const emailByOwner: Record<string, string> = {}
        for (const p of profilesRes.data ?? []) {
          emailByOwner[p.id] = p.email ?? ''
        }

        const productsBySupplier: Record<string, { categories: string[]; products: string[] }> = {}
        for (const row of productsRes.data ?? []) {
          const sid = row.supplier_id
          if (!productsBySupplier[sid]) productsBySupplier[sid] = { categories: [], products: [] }
          if (row.category && !productsBySupplier[sid].categories.includes(row.category))
            productsBySupplier[sid].categories.push(row.category)
          if (row.name) productsBySupplier[sid].products.push(row.name)
        }

        setSuppliers(
          (companies ?? []).map((c) => {
            const fromProducts = productsBySupplier[c.id]
            return {
              id: c.id,
              company_name: c.company_name ?? '',
              bio: c.bio ?? null,
              address: c.address ?? null,
              phone: c.phone ?? null,
              categories: fromProducts?.categories.length ? fromProducts.categories : null,
              products: fromProducts?.products.length ? fromProducts.products : null,
              verified: c.verified ?? false,
              country: c.country ?? null,
              sector: c.sector ?? null,
              email: emailByOwner[c.owner_id] ?? '',
            }
          }) as Supplier[]
        )
      } catch (err) {
        console.error('Error loading suppliers:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadSuppliers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return suppliers.filter((s) => {
      if (
        q &&
        !s.company_name?.toLowerCase().includes(q) &&
        !s.bio?.toLowerCase().includes(q) &&
        !s.products?.some((p) => p.toLowerCase().includes(q))
      )
        return false
      if (selectedCategory !== 'all' && !s.categories?.includes(selectedCategory)) return false
      if (selectedCountry !== 'all' && s.country !== selectedCountry) return false
      if (selectedSector !== 'all' && s.sector !== selectedSector) return false
      return true
    })
  }, [suppliers, searchQuery, selectedCategory, selectedCountry, selectedSector])

  const stats = useMemo(
    () => ({
      total: suppliers.length,
      verified: suppliers.filter((s) => s.verified).length,
      countries: new Set(suppliers.map((s) => s.country).filter(Boolean)).size,
    }),
    [suppliers]
  )

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedCountry !== 'all' ||
    selectedSector !== 'all' ||
    searchQuery !== ''

  const clearAll = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedCountry('all')
    setSelectedSector('all')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
            <Building2 className="h-3 w-3" aria-hidden />
            Supplier network
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Supplier Directory</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Browse verified suppliers across LATAM. Each supplier can be linked to a deal for
            milestone-based payment via escrow.
          </p>
        </div>

        {/* Stat tiles */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total suppliers</p>
              <p className="text-2xl font-bold tabular-nums">{isLoading ? '—' : stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-success/30 bg-success/5 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verified</p>
              <p className="text-2xl font-bold tabular-nums text-success">
                {isLoading ? '—' : stats.verified}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Globe className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Countries</p>
              <p className="text-2xl font-bold tabular-nums">{isLoading ? '—' : stats.countries}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-foreground text-background'
                    : 'border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {cat.label}
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
                placeholder="Search suppliers or products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by country">
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
              <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by sector">
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

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium capitalize">
                {selectedCategory}
                <button
                  type="button"
                  aria-label="Remove category filter"
                  onClick={() => setSelectedCategory('all')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedCountry !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                {getCountryLabel(selectedCountry)}
                <button
                  type="button"
                  aria-label="Remove country filter"
                  onClick={() => setSelectedCountry('all')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedSector !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium">
                {getSectorLabel(selectedSector)}
                <button
                  type="button"
                  aria-label="Remove sector filter"
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
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        )}

        {/* Result count */}
        <p className="mb-4 text-sm text-muted-foreground">
          {isLoading
            ? 'Loading suppliers…'
            : `${filteredSuppliers.length} ${filteredSuppliers.length === 1 ? 'supplier' : 'suppliers'}`}
        </p>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl border-2 border-border bg-muted/40"
              />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="mb-1 text-base font-semibold">No suppliers found</p>
            <p className="mb-5 max-w-xs text-sm text-muted-foreground">
              {suppliers.length === 0
                ? 'No suppliers have been registered yet.'
                : 'Try adjusting your filters or search query.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((supplier) => (
              <Link
                key={supplier.id}
                href={`/suppliers/${supplier.id}`}
                className="group flex flex-col rounded-2xl border-2 border-border bg-card transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* Card header */}
                <div className="flex-1 p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {supplier.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Verified
                        </span>
                      )}
                      {supplier.categories?.[0] && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {supplier.categories[0]}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <h3 className="mb-1 text-base font-bold leading-snug transition-colors group-hover:text-primary">
                    {supplier.company_name}
                  </h3>

                  {(supplier.sector || supplier.country) && (
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {supplier.sector && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3 shrink-0" aria-hidden />
                          {getSectorLabel(supplier.sector)}
                        </span>
                      )}
                      {supplier.country && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3 shrink-0" aria-hidden />
                          {getCountryLabel(supplier.country)}
                        </span>
                      )}
                    </div>
                  )}

                  {supplier.bio && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{supplier.bio}</p>
                  )}
                </div>

                {/* Products preview */}
                {supplier.products && supplier.products.length > 0 && (
                  <div className="mx-5 mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Products
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-sm">
                      {supplier.products.join(', ')}
                    </p>
                  </div>
                )}

                {/* Email */}
                {supplier.email && (
                  <div className="mx-5 mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}

                {/* CTA */}
                <div className="p-5 pt-0">
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/50 py-2.5 text-sm font-semibold transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    View supplier
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {!isLoading && suppliers.length > 0 && (
          <div className="mt-10 flex justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" aria-hidden />
              <span>
                Looking for a specific supplier?{' '}
                <Link href="/create-deal" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Start a deal
                </Link>{' '}
                and we&apos;ll help you connect.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
