'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  })

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
          full_name: profile.full_name || profile.contact_name || '',
          company_name: profile.company_name || '',
          phone: profile.phone || '',
          address: profile.address || '',
          bio: profile.bio || '',
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
      const updateData = {
        full_name: formData.full_name,
        company_name: formData.company_name,
        phone: formData.phone,
        address: formData.address,
        bio: formData.bio,
        updated_at: new Date().toISOString(),
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

                {profile?.user_type === 'supplier' && (
                  <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                    As a supplier, manage your products and categories from your{' '}
                    <Link href="/dashboard/supplier-profile" className="font-medium underline hover:text-foreground">
                      Products & Categories
                    </Link>{' '}
                    page (also available in Quick Actions on your dashboard).
                  </p>
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
