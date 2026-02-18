'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Loader2,
  Package,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { PRODUCT_CATEGORIES, getCategoryLabel } from '@/lib/categories'
import { LATAM_COUNTRIES, SECTORS } from '@/lib/constants'

const PAGE_SIZE = 20
const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'category_asc', label: 'Category' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
] as const

interface SupplierProduct {
  id: string
  supplier_id: string
  name: string
  category: string
  price_per_unit: number
  description: string | null
  minimum_order: number | null
  delivery_time: string | null
}


type SupplierCompany = {
  id: string
  company_name: string | null
  bio: string | null
  country: string | null
  sector: string | null
  phone: string | null
}

export default function SupplierProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingBio, setIsSavingBio] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [profile, setProfile] = useState<{ bio?: string; user_type?: string } | null>(null)
  const [companies, setCompanies] = useState<SupplierCompany[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [products, setProducts] = useState<SupplierProduct[]>([])
  const [bio, setBio] = useState('')
  const [companyCountry, setCompanyCountry] = useState('')
  const [companySector, setCompanySector] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sort, setSort] = useState<string>('name_asc')
  const [page, setPage] = useState(0)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<SupplierProduct | null>(null)
  const [formProduct, setFormProduct] = useState({
    name: '',
    category: '',
    price_per_unit: '',
    description: '',
    minimum_order: '',
    delivery_time: '',
  })
  const [formSaving, setFormSaving] = useState(false)
  const [addCompanyOpen, setAddCompanyOpen] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanyCountry, setNewCompanyCountry] = useState('')
  const [newCompanySector, setNewCompanySector] = useState('')
  const [newCompanyPhone, setNewCompanyPhone] = useState('')
  const [addCompanySaving, setAddCompanySaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push('/auth/login')
        return
      }
      setUser(u)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', u.id)
        .single()

      if (profileData?.user_type !== 'supplier') {
        router.push('/dashboard')
        return
      }
      setProfile(profileData)

      const { data: companiesData } = await supabase
        .from('supplier_companies')
        .select('id, company_name, bio, country, sector, phone')
        .eq('owner_id', u.id)
        .order('company_name')

      const companiesList = (companiesData ?? []) as SupplierCompany[]
      setCompanies(companiesList)
      if (companiesList.length > 0) {
        setSelectedCompanyId((prev) => prev || companiesList[0].id)
      }
      setIsLoading(false)
    }
    load()
  }, [router, supabase])

  useEffect(() => {
    if (!selectedCompanyId || !user) return
    const loadProducts = async () => {
      const { data: productsData } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', selectedCompanyId)
        .order('name')
      setProducts((productsData as SupplierProduct[]) ?? [])
    }
    loadProducts()
    const company = companies.find((c) => c.id === selectedCompanyId)
    setBio(company?.bio ?? '')
    setCompanyCountry(company?.country ?? '')
    setCompanySector(company?.sector ?? '')
    setCompanyPhone(company?.phone ?? '')
  }, [selectedCompanyId, user, companies])

  const categoriesFromProducts = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products]
  )

  const filteredAndSorted = useMemo(() => {
    let list = [...products]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false) ||
          p.category.toLowerCase().includes(q)
      )
    }
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter)
    }
    const [field, dir] = sort.includes('_') ? sort.split('_') : ['name', 'asc']
    list.sort((a, b) => {
      if (field === 'name') {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        return dir === 'asc' ? cmp : -cmp
      }
      if (field === 'category') {
        const cmp = a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
        return dir === 'asc' ? cmp : -cmp
      }
      if (field === 'price') {
        const cmp = Number(a.price_per_unit) - Number(b.price_per_unit)
        return dir === 'asc' ? cmp : -cmp
      }
      return 0
    })
    return list
  }, [products, search, categoryFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginatedProducts = useMemo(
    () =>
      filteredAndSorted.slice(
        currentPage * PAGE_SIZE,
        currentPage * PAGE_SIZE + PAGE_SIZE
      ),
    [filteredAndSorted, currentPage]
  )

  const handleSaveBio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedCompanyId) return
    setIsSavingBio(true)
    try {
      const { error } = await supabase
        .from('supplier_companies')
        .update({
          bio,
          country: companyCountry || null,
          sector: companySector || null,
          phone: companyPhone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedCompanyId)
        .eq('owner_id', user.id)
      if (error) throw error
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === selectedCompanyId
            ? { ...c, bio, country: companyCountry || null, sector: companySector || null, phone: companyPhone.trim() || null }
            : c
        )
      )
      toast.success('Company details saved.')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save bio.')
    } finally {
      setIsSavingBio(false)
    }
  }

  const openAddDialog = () => {
    setFormProduct({
      name: '',
      category: '',
      price_per_unit: '',
      description: '',
      minimum_order: '',
      delivery_time: '',
    })
    setAddDialogOpen(true)
  }

  const openEditDialog = (p: SupplierProduct) => {
    const categoryValue = PRODUCT_CATEGORIES.some((c) => c.value === p.category)
      ? p.category
      : 'other'
    setFormProduct({
      name: p.name,
      category: categoryValue,
      price_per_unit: String(p.price_per_unit),
      description: p.description ?? '',
      minimum_order: p.minimum_order != null ? String(p.minimum_order) : '',
      delivery_time: p.delivery_time ?? '',
    })
    setEditingProduct(p)
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const name = formProduct.name.trim()
    const category = formProduct.category.trim().toLowerCase()
    const price = Number.parseFloat(formProduct.price_per_unit)
    if (!name || !category || Number.isNaN(price) || price <= 0) {
      toast.error('Enter product name, category, and a valid price.')
      return
    }
    setFormSaving(true)
    try {
      const minOrder = formProduct.minimum_order.trim()
        ? Number.parseFloat(formProduct.minimum_order)
        : null
      const deliveryTime = formProduct.delivery_time.trim() || null
      if (!selectedCompanyId) {
        toast.error('Select a company first.')
        setFormSaving(false)
        return
      }
      const { data, error } = await supabase
        .from('supplier_products')
        .insert({
          supplier_id: selectedCompanyId,
          name,
          category,
          price_per_unit: price,
          description: formProduct.description.trim() || null,
          minimum_order: minOrder != null && !Number.isNaN(minOrder) && minOrder >= 0 ? minOrder : null,
          delivery_time: deliveryTime,
        })
        .select()
        .single()
      if (error) throw error
      setProducts((prev) => [...prev, data as SupplierProduct])
      setAddDialogOpen(false)
      setFormProduct({
        name: '',
        category: '',
        price_per_unit: '',
        description: '',
        minimum_order: '',
        delivery_time: '',
      })
      toast.success('Product added.')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add product.')
    } finally {
      setFormSaving(false)
    }
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    const name = formProduct.name.trim()
    const category = formProduct.category.trim().toLowerCase()
    const price = Number.parseFloat(formProduct.price_per_unit)
    if (!name || !category || Number.isNaN(price) || price <= 0) {
      toast.error('Enter product name, category, and a valid price.')
      return
    }
    setFormSaving(true)
    try {
      const minOrder = formProduct.minimum_order.trim()
        ? Number.parseFloat(formProduct.minimum_order)
        : null
      const deliveryTime = formProduct.delivery_time.trim() || null
      const { error } = await supabase
        .from('supplier_products')
        .update({
          name,
          category,
          price_per_unit: price,
          description: formProduct.description.trim() || null,
          minimum_order: minOrder != null && !Number.isNaN(minOrder) && minOrder >= 0 ? minOrder : null,
          delivery_time: deliveryTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProduct.id)
      if (error) throw error
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name,
                category,
                price_per_unit: price,
                description: formProduct.description.trim() || null,
                minimum_order: minOrder != null && !Number.isNaN(minOrder) && minOrder >= 0 ? minOrder : null,
                delivery_time: deliveryTime,
              }
            : p
        )
      )
      setEditingProduct(null)
      setFormProduct({
        name: '',
        category: '',
        price_per_unit: '',
        description: '',
        minimum_order: '',
        delivery_time: '',
      })
      toast.success('Product updated.')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update product.')
    } finally {
      setFormSaving(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!deleteProduct) return
    try {
      const { error } = await supabase
        .from('supplier_products')
        .delete()
        .eq('id', deleteProduct.id)
      if (error) throw error
      setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id))
      setDeleteProduct(null)
      toast.success('Product removed.')
    } catch (err) {
      console.error(err)
      toast.error('Failed to remove product.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </div>
    )
  }

  const productForm = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="form-name">Product name</Label>
          <Input
            id="form-name"
            value={formProduct.name}
            onChange={(e) => setFormProduct((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Organic Flour 25kg"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-category">Category</Label>
          <Select
            value={formProduct.category || undefined}
            onValueChange={(v) => setFormProduct((prev) => ({ ...prev, category: v }))}
          >
            <SelectTrigger id="form-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-price">Price per unit (USDC)</Label>
        <Input
          id="form-price"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={formProduct.price_per_unit}
          onChange={(e) =>
            setFormProduct((prev) => ({ ...prev, price_per_unit: e.target.value }))
          }
          placeholder="90.00"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="form-min-order">Minimum order (USD, optional)</Label>
          <Input
            id="form-min-order"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={formProduct.minimum_order}
            onChange={(e) =>
              setFormProduct((prev) => ({ ...prev, minimum_order: e.target.value }))
            }
            placeholder="e.g. 8000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-delivery">Typical delivery time (optional)</Label>
          <Input
            id="form-delivery"
            value={formProduct.delivery_time}
            onChange={(e) =>
              setFormProduct((prev) => ({ ...prev, delivery_time: e.target.value }))
            }
            placeholder="e.g. 7–10 days"
            autoComplete="off"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-desc">Description (optional)</Label>
        <Textarea
          id="form-desc"
          value={formProduct.description}
          onChange={(e) =>
            setFormProduct((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="e.g. Industrial wheat flour (25kg & 50kg sacks)"
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label="Back to dashboard">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Supplier profile</h1>
            <p className="text-muted-foreground">
              Company bio and product catalog. PyMEs select from your catalog when creating deals.
            </p>
          </div>
        </div>

        {companies.length === 0 ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Create your first company</CardTitle>
              <CardDescription>
                You can add multiple supplier companies under one account. Start with one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!user || !newCompanyName.trim()) return
                  setAddCompanySaving(true)
                  try {
                    const { data, error } = await supabase
                      .from('supplier_companies')
                      .insert({
                        owner_id: user.id,
                        company_name: newCompanyName.trim(),
                        country: newCompanyCountry || null,
                        sector: newCompanySector || null,
                        phone: newCompanyPhone.trim() || null,
                        updated_at: new Date().toISOString(),
                      })
                      .select('id, company_name, bio, country, sector, phone')
                      .single()
                    if (error) throw error
                    setCompanies((prev) => [...prev, data as SupplierCompany])
                    setSelectedCompanyId(data.id)
                    setNewCompanyName('')
                    setNewCompanyCountry('')
                    setNewCompanySector('')
                    setNewCompanyPhone('')
                    setAddCompanyOpen(false)
                    toast.success('Company created.')
                  } catch (err) {
                    console.error(err)
                    toast.error('Failed to create company.')
                  } finally {
                    setAddCompanySaving(false)
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="new-company-name">Company name</Label>
                  <Input
                    id="new-company-name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Acme Supplies"
                    autoComplete="organization"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-company-phone">Phone</Label>
                    <Input
                      id="new-company-phone"
                      type="tel"
                      value={newCompanyPhone}
                      onChange={(e) => setNewCompanyPhone(e.target.value)}
                      placeholder="e.g. +595 21 123 456"
                      autoComplete="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-company-country">Country</Label>
                    <Select value={newCompanyCountry || undefined} onValueChange={setNewCompanyCountry}>
                      <SelectTrigger id="new-company-country" aria-label="Country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {LATAM_COUNTRIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="new-company-sector">Sector</Label>
                    <Select value={newCompanySector || undefined} onValueChange={setNewCompanySector}>
                      <SelectTrigger id="new-company-sector" aria-label="Sector">
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={addCompanySaving || !newCompanyName.trim()}>
                  {addCompanySaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Creating…
                    </>
                  ) : (
                    'Create company'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="company-select" className="text-sm text-muted-foreground">
                  Company
                </Label>
                <Select
                  value={selectedCompanyId ?? ''}
                  onValueChange={(id) => setSelectedCompanyId(id)}
                >
                  <SelectTrigger id="company-select" className="w-[220px]">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name || 'Unnamed company'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAddCompanyOpen(true)}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Add company
              </Button>
            </div>

            {/* Company bio & details */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Company details</CardTitle>
                <CardDescription>
                  Country, sector, phone, and bio for this company. Shown to PyMEs when they browse suppliers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveBio} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Phone</Label>
                      <Input
                        id="company-phone"
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="e.g. +595 21 123 456"
                        autoComplete="tel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-country">Country</Label>
                      <Select
                        value={companyCountry || undefined}
                        onValueChange={setCompanyCountry}
                      >
                        <SelectTrigger id="company-country" aria-label="Company country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {LATAM_COUNTRIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-sector">Sector</Label>
                      <Select
                        value={companySector || undefined}
                        onValueChange={setCompanySector}
                      >
                        <SelectTrigger id="company-sector" aria-label="Company sector">
                          <SelectValue placeholder="Select sector" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTORS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="e.g., We supply wholesale ingredients to bakeries and restaurants…"
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={isSavingBio}>
                    {isSavingBio ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      'Save details'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Product catalog */}
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" aria-hidden />
                    Product catalog
                  </CardTitle>
                  <CardDescription>
                    Add and manage products for this company. PyMEs choose quantity when creating a deal.
                  </CardDescription>
                </div>
                <Button onClick={openAddDialog} className="shrink-0 gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Add product
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toolbar: search, filter, sort */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  className="pl-9"
                  aria-label="Search products"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={categoryFilter}
                  onValueChange={(v) => {
                    setCategoryFilter(v)
                    setPage(0)
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoriesFromProducts.map((c) => (
                      <SelectItem key={c} value={c}>
                        {getCategoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sort}
                  onValueChange={(v) => {
                    setSort(v)
                    setPage(0)
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            {filteredAndSorted.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
                {products.length === 0 ? (
                  <>
                    <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" aria-hidden />
                    <p className="font-medium">No products yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add your first product so PyMEs can select from your catalog.
                    </p>
                    <Button onClick={openAddDialog} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" aria-hidden />
                      Add product
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-medium">No matches</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try a different search or category filter.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setSearch('')
                        setCategoryFilter('all')
                        setPage(0)
                      }}
                    >
                      Clear filters
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price / unit</TableHead>
                        <TableHead className="text-right">Min. order</TableHead>
                        <TableHead>Delivery</TableHead>
                        <TableHead className="max-w-[200px]">Description</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{getCategoryLabel(p.category)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(Number(p.price_per_unit))} USDC
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.minimum_order != null
                              ? formatCurrency(p.minimum_order)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.delivery_time || '—'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {p.description || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(p)}
                                aria-label={`Edit ${p.name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteProduct(p)}
                                aria-label={`Delete ${p.name}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredAndSorted.length)} of {filteredAndSorted.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Contact info and wallet address?{' '}
              <Link href="/settings" className="underline hover:text-foreground">
                Settings
              </Link>
            </p>
          </>
        )}

      </div>

      {/* Add company dialog */}
      <Dialog open={addCompanyOpen} onOpenChange={setAddCompanyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add company</DialogTitle>
            <DialogDescription>
              Add another supplier company to your account. Each company has its own catalog and bio.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!user || !newCompanyName.trim()) return
              setAddCompanySaving(true)
              try {
                const { data, error } = await supabase
                  .from('supplier_companies')
                  .insert({
                    owner_id: user.id,
                    company_name: newCompanyName.trim(),
                    country: newCompanyCountry || null,
                    sector: newCompanySector || null,
                    phone: newCompanyPhone.trim() || null,
                    updated_at: new Date().toISOString(),
                  })
                  .select('id, company_name, bio, country, sector, phone')
                  .single()
                if (error) throw error
                setCompanies((prev) => [...prev, data as SupplierCompany])
                setSelectedCompanyId(data.id)
                setNewCompanyName('')
                setNewCompanyCountry('')
                setNewCompanySector('')
                setNewCompanyPhone('')
                setAddCompanyOpen(false)
                toast.success('Company added.')
              } catch (err) {
                console.error(err)
                toast.error('Failed to add company.')
              } finally {
                setAddCompanySaving(false)
              }
            }}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dialog-company-name">Company name</Label>
                <Input
                  id="dialog-company-name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Acme Supplies"
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-company-phone">Phone</Label>
                <Input
                  id="dialog-company-phone"
                  type="tel"
                  value={newCompanyPhone}
                  onChange={(e) => setNewCompanyPhone(e.target.value)}
                  placeholder="e.g. +595 21 123 456"
                  autoComplete="tel"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dialog-company-country">Country</Label>
                  <Select value={newCompanyCountry || undefined} onValueChange={setNewCompanyCountry}>
                    <SelectTrigger id="dialog-company-country" aria-label="Country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {LATAM_COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dialog-company-sector">Sector</Label>
                  <Select value={newCompanySector || undefined} onValueChange={setNewCompanySector}>
                    <SelectTrigger id="dialog-company-sector" aria-label="Sector">
                      <SelectValue placeholder="Select sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTORS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setAddCompanyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addCompanySaving || !newCompanyName.trim()}>
                {addCompanySaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Adding…
                  </>
                ) : (
                  'Add company'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add product dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
            <DialogDescription>
              Name, category, and price per unit (USDC) are required. PyMEs will set quantity when creating a deal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddProduct}>
            {productForm}
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={formSaving}>
                {formSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Adding…
                  </>
                ) : (
                  'Add product'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit product dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              Update name, category, price, or description.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct}>
            {productForm}
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingProduct(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={formSaving}>
                {formSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteProduct?.name}&quot; from your catalog. PyMEs will no longer see it when creating deals. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
