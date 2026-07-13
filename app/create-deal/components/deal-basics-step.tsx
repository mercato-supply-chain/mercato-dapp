'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Package } from 'lucide-react'
import { formatCurrency, formatUSDC } from '@/lib/format'
import { getLocalizedCategoryLabel } from '@/lib/categories'
import { ProductImage } from '@/components/media/product-image'
import { SupplierLogo } from '@/components/suppliers/supplier-logo'
import { getAvailableQuantity } from '@/lib/supplier-profile/inventory'
import type { CreateDealFormData } from '../types'
import { useI18n } from '@/lib/i18n/provider'

interface SupplierOption {
  id: string
  company_name: string
  email?: string
  address?: string
  logo_url?: string | null
}

interface ProductOption {
  id: string
  name: string
  category: string
  price_per_unit: number
  description?: string | null
  image_url?: string | null
  unit?: string
  stock_quantity?: number
  reserved_quantity?: number
}

interface DealBasicsStepProps {
  formData: Pick<
    CreateDealFormData,
    'category' | 'supplierId' | 'productId' | 'description' | 'quantity'
  >
  availableCategories: string[]
  filteredSuppliers: SupplierOption[]
  productsForSupplier: ProductOption[]
  totalAmount: number
  onUpdate: (field: keyof CreateDealFormData, value: string) => void
  onSupplierSelect: (supplierId: string) => void
}

export function DealBasicsStep({
  formData,
  availableCategories,
  filteredSuppliers,
  productsForSupplier,
  totalAmount,
  onUpdate,
  onSupplierSelect,
}: DealBasicsStepProps) {
  const { t, messages } = useI18n()
  const selectedProduct = productsForSupplier.find((p) => p.id === formData.productId)
  const selectedAvailable = selectedProduct
    ? getAvailableQuantity({
        stock_quantity: selectedProduct.stock_quantity ?? 0,
        reserved_quantity: selectedProduct.reserved_quantity ?? 0,
      })
    : null
  const requestedQty = Number.parseInt(formData.quantity, 10)
  const quantityExceedsStock =
    selectedAvailable != null &&
    selectedAvailable > 0 &&
    !Number.isNaN(requestedQty) &&
    requestedQty > selectedAvailable

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" aria-hidden />
          {t('createDeal.basicsTitle')}
        </CardTitle>
        <CardDescription>
          {t('createDeal.basicsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="category">{t('common.category')}</Label>
          <Select
            value={formData.category}
            onValueChange={(v) => onUpdate('category', v)}
          >
            <SelectTrigger id="category">
              <SelectValue
                placeholder={
                  availableCategories.length > 0
                    ? t('createDeal.selectCategory')
                    : t('createDeal.noCategories')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {t('createDeal.catalogEmpty')}
                </div>
              ) : (
                availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {getLocalizedCategoryLabel(cat, messages)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier">{t('createDeal.supplier')}</Label>
          <Select
            value={formData.supplierId}
            onValueChange={(v) => {
              onSupplierSelect(v)
            }}
          >
            <SelectTrigger id="supplier">
              <SelectValue
                placeholder={
                  filteredSuppliers.length > 0
                    ? t('createDeal.selectSupplier')
                    : t('createDeal.selectCategoryFirst')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {filteredSuppliers.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {t('createDeal.noSuppliersCategory')}
                </div>
              ) : (
                filteredSuppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <SupplierLogo logoUrl={s.logo_url} companyName={s.company_name} size="xs" />
                      {s.company_name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product">{t('createDeal.product')}</Label>
          <Select
            value={formData.productId}
            onValueChange={(v) => onUpdate('productId', v)}
          >
            <SelectTrigger id="product">
              <SelectValue
                placeholder={
                  productsForSupplier.length > 0
                    ? t('createDeal.selectProductPlaceholder')
                    : t('createDeal.selectSupplierFirst')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {productsForSupplier.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {t('createDeal.noProductsSupplier')}
                </div>
              ) : (
                productsForSupplier.map((p) => {
                  const available = getAvailableQuantity({
                    stock_quantity: p.stock_quantity ?? 0,
                    reserved_quantity: p.reserved_quantity ?? 0,
                  })
                  const unit = p.unit || t('createDeal.unit')
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <ProductImage imageUrl={p.image_url} alt={p.name} size="xs" />
                        <span>
                          {p.name} — {formatCurrency(p.price_per_unit)} USDC/{unit}
                          {available > 0
                            ? ` · ${t('createDeal.unitsAvailable', { count: available })}`
                            : ` · ${t('createDeal.outOfStock')}`}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">{t('common.quantity')}</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder={t('createDeal.quantityPlaceholder')}
            value={formData.quantity}
            onChange={(e) => onUpdate('quantity', e.target.value)}
            aria-required
          />
          {selectedAvailable != null && selectedAvailable > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('createDeal.unitsAvailable', { count: selectedAvailable })}
            </p>
          )}
          {selectedAvailable === 0 && formData.productId && (
            <p className="text-xs text-destructive">{t('createDeal.outOfStock')}</p>
          )}
          {quantityExceedsStock && selectedAvailable != null && (
            <p className="text-xs text-destructive">
              {t('createDeal.quantityExceedsStock', { count: selectedAvailable })}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('createDeal.descriptionOptional')}</Label>
          <Textarea
            id="description"
            name="description"
            autoComplete="off"
            placeholder={t('createDeal.descriptionPlaceholder')}
            value={formData.description}
            onChange={(e) => onUpdate('description', e.target.value)}
            rows={3}
          />
        </div>

        {totalAmount > 0 && (
          <div className="rounded-lg border border-accent bg-accent/5 p-4">
            <p className="text-sm text-muted-foreground">{t('createDeal.totalDealAmount')}</p>
            <p className="text-3xl font-bold text-accent tabular-nums">
              {formatUSDC(totalAmount)} USDC
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
