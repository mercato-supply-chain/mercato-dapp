'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LATAM_COUNTRIES, SECTORS } from '@/lib/constants'
import { useI18n } from '@/lib/i18n/provider'

export type ProfileFormState = {
  full_name: string
  company_name: string
  phone: string
  address: string
  bio: string
  country: string
  sector: string
}

type SettingsProfileFormProps = {
  userType: string
  formData: ProfileFormState
  onChange: (patch: Partial<ProfileFormState>) => void
  isSaving: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function SettingsProfileForm({
  userType,
  formData,
  onChange,
  isSaving,
  onSubmit,
  onCancel,
}: SettingsProfileFormProps) {
  const { t, messages } = useI18n()
  const showBusinessFields = userType === 'pyme' || userType === 'supplier'

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="full_name">{t('settings.fullNameLabel')}</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => onChange({ full_name: e.target.value })}
            placeholder={t('settings.fullNamePlaceholder')}
            autoComplete="name"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="company_name">{t('settings.companyNameLabel')}</Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => onChange({ company_name: e.target.value })}
            placeholder={t('settings.companyNamePlaceholder')}
            autoComplete="organization"
          />
        </div>

        {showBusinessFields && (
          <>
            <div className="space-y-2">
              <Label htmlFor="country">{t('settings.countryLabel')}</Label>
              <Select value={formData.country || undefined} onValueChange={(v) => onChange({ country: v })}>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">{t('settings.sectorLabel')}</Label>
              <Select value={formData.sector || undefined} onValueChange={(v) => onChange({ sector: v })}>
                <SelectTrigger id="sector" aria-label={t('settings.sectorLabel')}>
                  <SelectValue placeholder={t('settings.sectorPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => {
                    const label = messages.geo.sectors[s.value as keyof typeof messages.geo.sectors] ?? s.label
                    return (
                      <SelectItem key={s.value} value={s.value}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">{t('settings.phoneLabel')}</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder={t('settings.phonePlaceholder')}
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">{t('settings.walletAddressLabel')}</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder={t('settings.walletAddressPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('settings.walletAddressHint')}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">{t('settings.bioLabel')}</Label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
          placeholder={t('settings.bioPlaceholder')}
          rows={4}
          className="resize-none"
        />
      </div>

      {userType === 'supplier' && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-50/40 p-4 text-sm text-muted-foreground dark:bg-amber-950/20">
          {t('settings.supplierNoticePrefix')}{' '}
          <Link href="/dashboard/supplier-profile" className="font-medium text-foreground underline-offset-4 hover:underline">
            {t('nav.productsCategories')}
          </Link>{' '}
          {t('settings.supplierNoticeSuffix')}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="rounded-full" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isSaving} className="rounded-full">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              {t('common.saving')}
            </>
          ) : (
            t('settings.saveChanges')
          )}
        </Button>
      </div>
    </form>
  )
}
