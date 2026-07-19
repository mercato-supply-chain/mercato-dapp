'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getLocalizedCategoryLabel, PRODUCT_CATEGORIES } from '@/lib/categories'
import type { ProductFormState } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'

const UNIT_VALUES = ['unit', 'kg', 'lb', 'box', 'case', 'pallet', 'liter', 'm'] as const

export function ProductBasicsStep({
  formProduct,
  onChange,
}: {
  formProduct: ProductFormState
  onChange: (patch: Partial<ProductFormState>) => void
}) {
  const { t, messages } = useI18n()

  const unitLabel = (unit: string) => {
    const key = `supplierProfile.unit.${unit}`
    const label = t(key)
    return label === key ? unit : label
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">{t('supplierProfile.wizardStepBasicsTitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('supplierProfile.wizardStepBasicsHint')}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="form-name">{t('supplierProfile.formProductName')}</Label>
          <Input
            id="form-name"
            value={formProduct.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('supplierProfile.formProductNamePh')}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-category">{t('supplierProfile.formCategory')}</Label>
          <Select
            value={formProduct.category || undefined}
            onValueChange={(v) => onChange({ category: v })}
          >
            <SelectTrigger id="form-category">
              <SelectValue placeholder={t('supplierProfile.formSelectCategory')} />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {getLocalizedCategoryLabel(c.value, messages)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="form-sku">{t('supplierProfile.formSku')}</Label>
          <Input
            id="form-sku"
            value={formProduct.sku}
            onChange={(e) => onChange({ sku: e.target.value })}
            placeholder={t('supplierProfile.formSkuPh')}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-unit">{t('supplierProfile.formUnit')}</Label>
          <Select value={formProduct.unit} onValueChange={(v) => onChange({ unit: v })}>
            <SelectTrigger id="form-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_VALUES.map((u) => (
                <SelectItem key={u} value={u}>
                  {unitLabel(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-desc">{t('supplierProfile.formDescription')}</Label>
        <Textarea
          id="form-desc"
          value={formProduct.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t('supplierProfile.formDescriptionPh')}
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  )
}
