'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Building2,
  Mail,
  Phone,
  Search,
  Package,
  Wallet,
  ArrowRight,
  Globe,
  Briefcase,
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
  'All Categories',
  'electronics',
  'textiles',
  'food',
  'manufacturing',
  'agriculture',
  'construction',
  'other'
]

export default function SuppliersPage() {
  const supabase = createClient()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    filterSuppliers()
  }, [suppliers, searchQuery, selectedCategory, selectedCountry, selectedSector])

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, company_name, bio, address, phone, categories, products, verified, country, sector')
        .eq('user_type', 'supplier')
        .order('company_name')

      if (error) throw error

      // Join with auth.users to get email
      const suppliersWithEmail = await Promise.all(
        (data || []).map(async (supplier) => {
          const { data: { user } } = await supabase.auth.admin.getUserById(supplier.id)
          return {
            ...supplier,
            email: user?.email || ''
          }
        })
      )

      setSuppliers(suppliersWithEmail as Supplier[])
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterSuppliers = () => {
    let filtered = [...suppliers]

    if (searchQuery) {
      filtered = filtered.filter(
        (supplier) =>
          supplier.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          supplier.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          supplier.products?.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter((supplier) =>
        supplier.categories?.includes(selectedCategory)
      )
    }

    if (selectedCountry !== 'all') {
      filtered = filtered.filter((supplier) => supplier.country === selectedCountry)
    }

    if (selectedSector !== 'all') {
      filtered = filtered.filter((supplier) => supplier.sector === selectedSector)
    }

    setFilteredSuppliers(filtered)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Supplier Directory</h1>
          <p className="text-muted-foreground">
            Browse verified suppliers across different categories
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search suppliers, products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
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
            <div className="flex gap-1 overflow-x-auto pb-2">
              {CATEGORIES.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="whitespace-nowrap capitalize"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>
            {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'supplier' : 'suppliers'} found
          </span>
        </div>

        {/* Suppliers Grid */}
        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-muted-foreground">Loading suppliers…</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium">No suppliers found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((supplier) => (
              <Link key={supplier.id} href={`/suppliers/${supplier.id}`}>
                <Card className="h-full transition-colors hover:border-accent hover:bg-muted/30">
                  <CardHeader>
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      {supplier.verified && (
                        <Badge variant="secondary" className="bg-success/10 text-success">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{supplier.company_name}</CardTitle>
                    {(supplier.country || supplier.sector) && (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {supplier.sector && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {getSectorLabel(supplier.sector)}
                          </span>
                        )}
                        {supplier.country && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {getCountryLabel(supplier.country)}
                          </span>
                        )}
                      </div>
                    )}
                    {supplier.bio && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {supplier.bio}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Categories */}
                    {supplier.categories && supplier.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {supplier.categories.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-xs capitalize">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Products */}
                    {supplier.products && supplier.products.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Products</p>
                        <p className="text-sm line-clamp-2">{supplier.products.join(', ')}</p>
                      </div>
                    )}

                    {/* Contact Info */}
                    <div className="space-y-2 border-t border-border pt-3 text-sm">
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                      {supplier.address && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Wallet className="h-4 w-4 shrink-0" />
                          <span className="truncate font-mono text-xs">
                            {supplier.address.slice(0, 6)}...{supplier.address.slice(-4)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 text-primary text-sm font-medium">
                      View details
                      <ArrowRight className="h-4 w-4" />
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
