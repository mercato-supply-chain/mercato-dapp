'use client'

import React from "react"

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
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
    address: '',
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
        setProfile(profile)
        setFormData({
          full_name: profile.full_name || '',
          company_name: profile.company_name || '',
          phone: profile.phone || '',
          address: profile.address || '',
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
    setIsSaving(true)

    try {
      const updateData: any = {
        full_name: formData.full_name,
        company_name: formData.company_name,
        phone: formData.phone,
        address: formData.address,
        bio: formData.bio,
        updated_at: new Date().toISOString(),
      }

      // Only include supplier fields if user is a supplier
      if (profile?.user_type === 'supplier') {
        updateData.categories = formData.categories
        updateData.products = formData.products
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (error) throw error

      alert('Profile updated successfully!')
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
          <div className="mb-6">
            <h1 className="mb-2 text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and profile information
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile details and personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user_type">User Type</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {profile?.user_type || 'Not set'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    User type cannot be changed after registration
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Enter your company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Stellar Wallet Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="GA7X... or GD2X..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Stellar wallet address for receiving/sending payments
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell us about yourself or your business"
                    rows={4}
                  />
                </div>

                {/* Supplier-specific fields */}
                {profile?.user_type === 'supplier' && (
                  <>
                    <div className="border-t border-border pt-6">
                      <h3 className="mb-4 font-semibold">Supplier Information</h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Categories</Label>
                          <div className="flex gap-2">
                            <Input
                              value={categoryInput}
                              onChange={(e) => setCategoryInput(e.target.value)}
                              placeholder="e.g., electronics, textiles"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  if (categoryInput.trim() && !formData.categories.includes(categoryInput.trim())) {
                                    setFormData({ 
                                      ...formData, 
                                      categories: [...formData.categories, categoryInput.trim().toLowerCase()] 
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
                                    categories: [...formData.categories, categoryInput.trim().toLowerCase()] 
                                  })
                                  setCategoryInput('')
                                }
                              }}
                            >
                              Add
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {formData.categories.map((cat) => (
                              <Badge 
                                key={cat} 
                                variant="secondary"
                                className="cursor-pointer capitalize"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    categories: formData.categories.filter(c => c !== cat)
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
                              placeholder="e.g., LED displays, cotton fabric"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  if (productInput.trim() && !formData.products.includes(productInput.trim())) {
                                    setFormData({ 
                                      ...formData, 
                                      products: [...formData.products, productInput.trim()] 
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
                                    products: [...formData.products, productInput.trim()] 
                                  })
                                  setProductInput('')
                                }
                              }}
                            >
                              Add
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {formData.products.map((product) => (
                              <Badge 
                                key={product} 
                                variant="secondary"
                                className="cursor-pointer"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    products: formData.products.filter(p => p !== product)
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
                      </div>
                    </div>
                  </>
                )}

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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
