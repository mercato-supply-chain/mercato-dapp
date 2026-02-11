'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Building2, 
  Mail, 
  MapPin, 
  Phone, 
  Search,
  Package,
  Wallet
} from 'lucide-react'

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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    filterSuppliers()
  }, [suppliers, searchQuery, selectedCategory])

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, company_name, bio, address, phone, categories, products, verified')
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

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(supplier => 
        supplier.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.products?.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Filter by category
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(supplier => 
        supplier.categories?.includes(selectedCategory)
      )
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
          
          <div className="flex gap-2 overflow-x-auto pb-2">
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
            <p className="text-muted-foreground">Loading suppliers...</p>
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
              <Card key={supplier.id} className="hover:border-accent transition-colors">
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
                  {supplier.bio && (
                    <CardDescription className="line-clamp-2">
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
                      <p className="text-sm">{supplier.products.join(', ')}</p>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
