'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { PRODUCT_CATEGORIES, getLocalizedCategoryLabel } from '@/lib/categories'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { LATAM_COUNTRIES, SECTORS } from '@/lib/constants'
import type { CompanyFormState, SupplierCompany } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'
import { SupplierLogoUpload } from './supplier-logo-upload'

type SupplierCompanyDetailsProps = {
  company: SupplierCompany
  form: CompanyFormState
  onChange: (patch: Partial<CompanyFormState>) => void
  isSaving: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function SupplierCompanyDetails({
  company,
  form,
  onChange,
  isSaving,
  onSubmit,
}: SupplierCompanyDetailsProps) {
  const { t } = useI18n()

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {company.company_name || t('supplierProfile.unnamedCompany')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('supplierProfile.companyDetailsDescription')}</p>
        <p className="mt-2 inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-900 dark:text-amber-200">
          {t('supplierProfile.visibleToPymes')}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{t('supplierProfile.logoLabel')}</Label>
        <SupplierLogoUpload
          companyId={company.id}
          value={form.logo_url}
          onChange={(url) => onChange({ logo_url: url || '' })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company-phone">{t('supplierProfile.phone')}</Label>
          <Input
            id="company-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder={t('supplierProfile.placeholderPhonePh')}
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-country">{t('supplierProfile.country')}</Label>
          <Select value={form.country || undefined} onValueChange={(v) => onChange({ country: v })}>
            <SelectTrigger id="company-country" aria-label={t('supplierProfile.country')}>
              <SelectValue placeholder={t('supplierProfile.selectCountry')} />
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
          <Label htmlFor="company-website">{t('supplierProfile.website') || 'Website'}</Label>
          <Input
            id="company-website"
            type="url"
            value={form.website}
            onChange={(e) => onChange({ website: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-address">{t('supplierProfile.address') || 'Stellar Payment Address'}</Label>
          <Input
            id="company-address"
            value={form.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="G..."
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('supplierProfile.productCategories') || 'Product Categories'}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {PRODUCT_CATEGORIES.map((cat) => (
              <div key={cat.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`cat-${cat.value}`}
                  checked={form.categories.includes(cat.value)}
                  onCheckedChange={(checked) => {
                    const newCategories = checked
                      ? [...form.categories, cat.value]
                      : form.categories.filter((c) => c !== cat.value)
                    onChange({ categories: newCategories })
                  }}
                />
                <Label htmlFor={`cat-${cat.value}`} className="text-sm font-normal cursor-pointer">
                  {/* Note: we would need messages from useI18n, but since they are not directly available, we can just use t or label */}
                  {cat.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 sm:col-span-2 sm:max-w-md">
          <Label htmlFor="company-sector">{t('supplierProfile.sector')}</Label>
          <Select value={form.sector || undefined} onValueChange={(v) => onChange({ sector: v })}>
            <SelectTrigger id="company-sector" aria-label={t('supplierProfile.sector')}>
              <SelectValue placeholder={t('supplierProfile.selectSector')} />
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

      <div className="space-y-2">
        <Label htmlFor="bio">{t('supplierProfile.bio')}</Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
          placeholder={t('supplierProfile.placeholderBioPh')}
          rows={5}
          className="resize-none"
        />
      </div>

      <Button type="submit" disabled={isSaving} className="rounded-full">
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {t('supplierProfile.savingDetails')}
          </>
        ) : (
          t('supplierProfile.saveDetails')
        )}
      </Button>
    </form>
  )
}
