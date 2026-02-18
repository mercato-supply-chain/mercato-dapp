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


export default function SupplierProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingBio, setIsSavingBio] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [profile, setProfile] = useState<{ bio?: string; user_type?: string } | null>(null)
  const [products, setProducts] = useState<SupplierProduct[]>([])
  const [bio, setBio] = useState('')

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
        .select('bio, user_type')
        .eq('id', u.id)
        .single()

      if (profileData?.user_type !== 'supplier') {
        router.push('/dashboard')
        return
      }
      setProfile(profileData)
      setBio(profileData?.bio ?? '')

      const { data: productsData } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', u.id)
        .order('name')
      setProducts((productsData as SupplierProduct[]) ?? [])
      setIsLoading(false)
    }
    load()
  }, [router, supabase])

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
    if (!user) return
    setIsSavingBio(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      toast.success('Bio saved.')
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
      const { data, error } = await supabase
        .from('supplier_products')
        .insert({
          supplier_id: user.id,
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

        {/* Company bio */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Company bio</CardTitle>
            <CardDescription>
              Tell PyMEs about your business. Shown alongside your catalog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveBio} className="space-y-4">
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g., We supply wholesale ingredients to bakeries and restaurants…"
                rows={4}
                className="resize-none"
              />
              <Button type="submit" disabled={isSavingBio}>
                {isSavingBio ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Save bio'
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
                Add and manage products with name, category, and price. PyMEs choose quantity when creating a deal.
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
      </div>

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
