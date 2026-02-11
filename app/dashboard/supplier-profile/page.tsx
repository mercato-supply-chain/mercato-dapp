'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Package, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SupplierProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [formData, setFormData] = useState({
    bio: '',
    categories: [] as string[],
    products: [] as string[],
  })
  const [categoryInput, setCategoryInput] = useState('')
  const [productInput, setProductInput] = useState('')

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        if (profile.user_type !== 'supplier') {
          router.push('/dashboard')
          return
        }
        setProfile(profile)
        setFormData({
          bio: profile.bio || '',
          categories: profile.categories || [],
          products: profile.products || [],
        })
      }

      setIsLoading(false)
    }

    getProfile()
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          bio: formData.bio,
          categories: formData.categories,
          products: formData.products,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile((prev: any) => ({
        ...prev,
        bio: formData.bio,
        categories: formData.categories,
        products: formData.products,
      }))

      alert('Products & categories updated successfully!')
      router.push('/dashboard')
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Error updating profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Products & Categories</h1>
              <p className="text-muted-foreground">
                Manage the products and categories you offer as a supplier
              </p>
            </div>
          </div>

          {/* Saved catalog summary - show what's in the database */}
          {(formData.products.length > 0 || formData.categories.length > 0) && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Your saved catalog</CardTitle>
                <CardDescription>
                  This is what PyMEs see when they search for suppliers. You can edit below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {formData.categories.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="capitalize">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {formData.products.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Products</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.products.map((product) => (
                        <Badge key={product} variant="outline">
                          {product}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard">View on Dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Supplier Information
              </CardTitle>
              <CardDescription>
                Add the categories and products you supply so PyMEs can find you when creating deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bio">Company Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell PyMEs about your business, specialties, and what makes you unique"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categories</Label>
                  <div className="flex gap-2">
                    <Input
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      placeholder="e.g., food supplier, wholesale food"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (categoryInput.trim() && !formData.categories.includes(categoryInput.trim())) {
                            setFormData({
                              ...formData,
                              categories: [...formData.categories, categoryInput.trim().toLowerCase()],
                            })
                            setCategoryInput('')
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (categoryInput.trim() && !formData.categories.includes(categoryInput.trim())) {
                          setFormData({
                            ...formData,
                            categories: [...formData.categories, categoryInput.trim().toLowerCase()],
                          })
                          setCategoryInput('')
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.categories.length === 0 && (
                      <p className="text-sm text-muted-foreground">No categories added yet</p>
                    )}
                    {formData.categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className="cursor-pointer capitalize"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            categories: formData.categories.filter((c) => c !== cat),
                          })
                        }}
                      >
                        {cat} ×
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click a category to remove it
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Products</Label>
                  <div className="flex gap-2">
                    <Input
                      value={productInput}
                      onChange={(e) => setProductInput(e.target.value)}
                      placeholder="e.g., Flour & Grain Products, Baking Ingredients"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (productInput.trim() && !formData.products.includes(productInput.trim())) {
                            setFormData({
                              ...formData,
                              products: [...formData.products, productInput.trim()],
                            })
                            setProductInput('')
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (productInput.trim() && !formData.products.includes(productInput.trim())) {
                          setFormData({
                            ...formData,
                            products: [...formData.products, productInput.trim()],
                          })
                          setProductInput('')
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.products.length === 0 && (
                      <p className="text-sm text-muted-foreground">No products added yet</p>
                    )}
                    {formData.products.map((product) => (
                      <Badge
                        key={product}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            products: formData.products.filter((p) => p !== product),
                          })
                        }}
                      >
                        {product} ×
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click a product to remove it
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/dashboard">Cancel</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-sm text-muted-foreground">
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
