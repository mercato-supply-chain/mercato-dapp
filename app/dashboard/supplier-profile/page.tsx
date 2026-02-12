'use client'

import { useEffect, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Loader2, Package, ArrowLeft, Trash2, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'

interface SupplierProduct {
  id: string
  supplier_id: string
  name: string
  category: string
  price_per_unit: number
  description: string | null
}

function formatCategoryLabel(cat: string): string {
  return cat
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
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
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    price_per_unit: '',
    description: '',
  })

  useEffect(() => {
    const load = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const name = newProduct.name.trim()
    const category = newProduct.category.trim().toLowerCase()
    const price = Number.parseFloat(newProduct.price_per_unit)
    if (!name || !category || Number.isNaN(price) || price <= 0) {
      toast.error('Please enter product name, category, and a valid price.')
      return
    }
    try {
      const { data, error } = await supabase
        .from('supplier_products')
        .insert({
          supplier_id: user.id,
          name,
          category,
          price_per_unit: price,
          description: newProduct.description.trim() || null,
        })
        .select()
        .single()
      if (error) throw error
      setProducts((prev) => [...prev, data as SupplierProduct])
      setNewProduct({ name: '', category: '', price_per_unit: '', description: '' })
      toast.success('Product added.')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add product.')
    }
  }

  const handleDeleteProduct = async (id: string) => {
    try {
      const { error } = await supabase.from('supplier_products').delete().eq('id', id)
      if (error) throw error
      setProducts((prev) => prev.filter((p) => p.id !== id))
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

  const categoriesFromProducts = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ).sort()

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Products & Pricing</h1>
              <p className="text-muted-foreground">
                Add products with prices. PyMEs will select from your catalog and only choose quantity when creating a deal.
              </p>
            </div>
          </div>

          {/* Company bio */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Company Bio</CardTitle>
              <CardDescription>
                Tell PyMEs about your business and what you offer
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
                    'Save Bio'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Product catalog */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" aria-hidden />
                Product Catalog
              </CardTitle>
              <CardDescription>
                Each product needs a name, category, and price per unit (USDC). PyMEs see this when creating a deal and only set the quantity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* List */}
              {products.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Your products ({products.length})
                  </p>
                  <ul className="space-y-2">
                    {products.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className="capitalize">
                              {formatCategoryLabel(p.category)}
                            </Badge>
                            <span className="flex items-center gap-1 tabular-nums">
                              <DollarSign className="h-3 w-3" aria-hidden />
                              {formatCurrency(Number(p.price_per_unit))} USDC / unit
                            </span>
                          </div>
                          {p.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {p.description}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteProduct(p.id)}
                          aria-label={`Remove ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Add product form */}
              <form onSubmit={handleAddProduct} className="space-y-4 rounded-lg border border-dashed border-border p-4">
                <p className="text-sm font-medium">Add a product</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="product-name">Product name</Label>
                    <Input
                      id="product-name"
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g., Organic Flour 25kg"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-category">Category</Label>
                    <Input
                      id="product-category"
                      value={newProduct.category}
                      onChange={(e) =>
                        setNewProduct((prev) => ({ ...prev, category: e.target.value }))
                      }
                      placeholder="e.g., food & beverage"
                      list="categories-list"
                      autoComplete="off"
                    />
                    {categoriesFromProducts.length > 0 && (
                      <datalist id="categories-list">
                        {categoriesFromProducts.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="product-price">Price per unit (USDC)</Label>
                    <Input
                      id="product-price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={newProduct.price_per_unit}
                      onChange={(e) =>
                        setNewProduct((prev) => ({ ...prev, price_per_unit: e.target.value }))
                      }
                      placeholder="90.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-desc">Description (optional)</Label>
                  <Textarea
                    id="product-desc"
                    value={newProduct.description}
                    onChange={(e) =>
                      setNewProduct((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Short description for PyMEs"
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <Button type="submit">Add product</Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Need to update your contact info or wallet address?{' '}
            <Link href="/settings" className="underline hover:text-foreground">
              Go to Settings
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
