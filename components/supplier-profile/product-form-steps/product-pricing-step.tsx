'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProductFormState } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'

export function ProductPricingStep({
  formProduct,
  onChange,
}: {
  formProduct: ProductFormState
  onChange: (patch: Partial<ProductFormState>) => void
}) {
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">{t('supplierProfile.wizardStepPricingTitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('supplierProfile.wizardStepPricingHint')}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-price">{t('supplierProfile.formPriceLabel')}</Label>
        <Input
          id="form-price"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={formProduct.price_per_unit}
          onChange={(e) => onChange({ price_per_unit: e.target.value })}
          placeholder={t('supplierProfile.formPricePh')}
        />
      </div>
      <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-4">
        <div>
          <p className="text-sm font-medium">{t('supplierProfile.formInventorySection')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('supplierProfile.formInventoryHint')}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="form-stock">{t('supplierProfile.formStockOnHand')}</Label>
            <Input
              id="form-stock"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={formProduct.stock_quantity}
              onChange={(e) => onChange({ stock_quantity: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-reorder">{t('supplierProfile.formReorderPoint')}</Label>
            <Input
              id="form-reorder"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={formProduct.reorder_point}
              onChange={(e) => onChange({ reorder_point: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="form-min-order">{t('supplierProfile.formMinOrder')}</Label>
          <Input
            id="form-min-order"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={formProduct.minimum_order}
            onChange={(e) => onChange({ minimum_order: e.target.value })}
            placeholder={t('supplierProfile.formMinOrderPh')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-delivery">{t('supplierProfile.formDelivery')}</Label>
          <Input
            id="form-delivery"
            value={formProduct.delivery_time}
            onChange={(e) => onChange({ delivery_time: e.target.value })}
            placeholder={t('supplierProfile.formDeliveryPh')}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  )
}
