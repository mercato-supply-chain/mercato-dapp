'use client'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { LATAM_COUNTRIES, SECTORS } from '@/lib/constants'
import { WalletStatusCard } from '@/components/wallet/wallet-status-card'
import { useI18n } from '@/lib/i18n/provider'
import { localizedUserType } from '@/components/navigation/user-nav'

export default function SettingsPage() {
  const { t, messages } = useI18n()
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingStake, setIsSavingStake] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [stakeAmount, setStakeAmount] = useState('0')
  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
    address: '',
    bio: '',
    country: '',
    sector: '',
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
        setStakeAmount(String(Number(profile.stake_amount ?? 0)))
        setFormData({
          full_name: profile.full_name || profile.contact_name || '',
          company_name: profile.company_name || '',
          phone: profile.phone || '',
          address: profile.address || '',
          bio: profile.bio || '',
          country: profile.country || '',
          sector: profile.sector || '',
        })
      }

      setIsLoading(false)
    }

    getProfile()
  }, [router, supabase])

  const handleSaveStake = async () => {
    const amount = Number(stakeAmount)

    if (!Number.isFinite(amount) || amount < 0) {
      alert(t('settings.stakeInvalid'))
      return
    }

    setIsSavingStake(true)
    try {
      const response = await fetch('/api/reputation/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      })

      const result = (await response.json()) as {
        stakeAmount?: number
        stakeUpdatedAt?: string | null
        error?: string
      }

      if (!response.ok) {
        throw new Error(result.error || t('settings.stakeUpdateFailed'))
      }

      setStakeAmount(String(Number(result.stakeAmount ?? 0)))
      setProfile((prev: any) =>
        prev
          ? {
              ...prev,
              stake_amount: Number(result.stakeAmount ?? 0),
              stake_updated_at: result.stakeUpdatedAt ?? null,
            }
          : prev
      )
      alert(t('settings.stakeSuccess'))
    } catch (error) {
      console.error('Error updating stake signal:', error)
      alert(t('settings.stakeError'))
    } finally {
      setIsSavingStake(false)
    }
  }

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
        country: formData.country || null,
        sector: formData.sector || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (error) throw error

      alert(t('settings.profileSuccess'))
    } catch (error) {
      console.error('Error updating profile:', error)
      alert(t('settings.profileError'))
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
            <h1 className="mb-2 text-3xl font-bold">{t('settings.title')}</h1>
            <p className="text-muted-foreground">{t('settings.subtitle')}</p>
          </div>

          <div className="mb-6">
            <WalletStatusCard />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.profileTitle')}</CardTitle>
              <CardDescription>{t('settings.profileDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('common.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.emailLockedHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user_type">{t('settings.userTypeLabel')}</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {profile?.user_type
                        ? localizedUserType(profile.user_type, t)
                        : t('common.notSet')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('settings.userTypeLockedHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name">{t('settings.fullNameLabel')}</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder={t('settings.fullNamePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_name">{t('settings.companyNameLabel')}</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder={t('settings.companyNamePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">{t('settings.countryLabel')}</Label>
                  <Select
                    value={formData.country || undefined}
                    onValueChange={(v) => setFormData({ ...formData, country: v })}
                  >
                    <SelectTrigger id="country" aria-label={t('settings.countryLabel')}>
                      <SelectValue placeholder={t('settings.countryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {LATAM_COUNTRIES.map((c) => {
                        const label =
                          messages.geo.countries[c.value as keyof typeof messages.geo.countries] ?? c.label
                        return (
                          <SelectItem key={c.value} value={c.value}>
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('settings.countryHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">{t('settings.sectorLabel')}</Label>
                  <Select
                    value={formData.sector || undefined}
                    onValueChange={(v) => setFormData({ ...formData, sector: v })}
                  >
                    <SelectTrigger id="sector" aria-label={t('settings.sectorLabel')}>
                      <SelectValue placeholder={t('settings.sectorPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTORS.map((s) => {
                        const label =
                          messages.geo.sectors[s.value as keyof typeof messages.geo.sectors] ?? s.label
                        return (
                          <SelectItem key={s.value} value={s.value}>
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('settings.sectorHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t('settings.phoneLabel')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t('settings.phonePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t('settings.walletAddressLabel')}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t('settings.walletAddressPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.walletAddressHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stake_amount">{t('settings.stakeLabel')}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="stake_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveStake}
                      disabled={isSavingStake}
                    >
                      {isSavingStake ? t('common.saving') : t('settings.saveStake')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('settings.stakeHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">{t('settings.bioLabel')}</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder={t('settings.bioPlaceholder')}
                    rows={4}
                  />
                </div>

                {profile?.user_type === 'supplier' && (
                  <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                    {t('settings.supplierNoticePrefix')}{' '}
                    <Link href="/dashboard/supplier-profile" className="font-medium underline hover:text-foreground">
                      {t('nav.productsCategories')}
                    </Link>{' '}
                    {t('settings.supplierNoticeSuffix')}
                  </p>
                )}

                <div className="flex gap-4">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.saving')}
                      </>
                    ) : (
                      t('settings.saveChanges')
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                  >
                    {t('common.cancel')}
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
