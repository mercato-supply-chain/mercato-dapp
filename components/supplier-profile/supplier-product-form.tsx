'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
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
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import type { ProductFormState } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'

type SupplierProductFormProps = {
  formProduct: ProductFormState
  onChange: (patch: Partial<ProductFormState>) => void
}

export function SupplierProductForm({ formProduct, onChange }: SupplierProductFormProps) {
  const { t } = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error(t('supplierProfile.toastImageTypeError'))
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(t('supplierProfile.toastImageSizeError'))
      return
    }

    if (formProduct.imagePreview && formProduct.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(formProduct.imagePreview)
    }

    const previewUrl = URL.createObjectURL(file)
    onChange({ imageFile: file, imagePreview: previewUrl })
  }

  const handleRemoveImage = () => {
    if (formProduct.imagePreview && formProduct.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(formProduct.imagePreview)
    }
    onChange({ imageFile: null, imagePreview: null })
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
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
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      <div className="space-y-2">
        <Label>{t('supplierProfile.formProductImage')}</Label>
        {formProduct.imagePreview ? (
          <div className="flex items-center gap-4 p-4 border border-border/70 bg-muted/20 rounded-xl">
            <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-border/60 bg-muted/40">
              <img
                src={formProduct.imagePreview}
                alt="Product Preview"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground truncate">
                {formProduct.imageFile ? formProduct.imageFile.name : t('supplierProfile.formProductImage')}
              </p>
              <p className="text-xs text-muted-foreground">
                {formProduct.imageFile
                  ? `${(formProduct.imageFile.size / (1024 * 1024)).toFixed(2)} MB`
                  : ''}
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 text-xs rounded-full mt-1"
                onClick={handleRemoveImage}
              >
                {t('supplierProfile.formProductImageRemove')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/20 hover:border-primary/50 bg-muted/5 hover:bg-muted/10'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground text-center hidden sm:block">
              {t('supplierProfile.formProductImageSelect')}
            </p>
            <p className="text-sm font-medium text-foreground text-center sm:hidden">
              {t('supplierProfile.formProductImageSelectMobile')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('supplierProfile.formProductImageHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
