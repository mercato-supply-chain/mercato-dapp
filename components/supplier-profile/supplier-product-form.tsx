'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProductFormState } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'
import { TOTAL_STEPS, type ProductFormStep } from './product-form-steps/types'
import { ProductFormStepProgress } from './product-form-steps/product-form-step-progress'
import { ProductBasicsStep } from './product-form-steps/product-basics-step'

type SupplierProductFormProps = {
  formProduct: ProductFormState
  onChange: (patch: Partial<ProductFormState>) => void
  formSaving: boolean
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  submittingLabel: string
  /** Bump when the dialog opens so the wizard restarts at step 1. */
  resetKey: string | number | boolean
}

function ProductPricingStep({
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

function ProductMediaStep({
  formProduct,
  onChange,
}: {
  formProduct: ProductFormState
  onChange: (patch: Partial<ProductFormState>) => void
}) {
  const { t } = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">{t('supplierProfile.wizardStepMediaTitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('supplierProfile.wizardStepMediaHint')}
        </p>
      </div>
      <div className="space-y-2">
        <Label>{t('supplierProfile.formProductImage')}</Label>
        {formProduct.imagePreview ? (
          <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/40">
              <img
                src={formProduct.imagePreview}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">
                {formProduct.imageFile
                  ? formProduct.imageFile.name
                  : t('supplierProfile.formProductImage')}
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
                className="mt-1 h-8 rounded-full text-xs"
                onClick={handleRemoveImage}
              >
                {t('supplierProfile.formProductImageRemove')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFile(file)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/20 bg-muted/5 hover:border-primary/50 hover:bg-muted/10'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="hidden text-center text-sm font-medium text-foreground sm:block">
              {t('supplierProfile.formProductImageSelect')}
            </p>
            <p className="text-center text-sm font-medium text-foreground sm:hidden">
              {t('supplierProfile.formProductImageSelectMobile')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('supplierProfile.formProductImageHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function SupplierProductForm({
  formProduct,
  onChange,
  formSaving,
  onSubmit,
  onCancel,
  submitLabel,
  submittingLabel,
  resetKey,
}: SupplierProductFormProps) {
  const { t } = useI18n()
  const [currentStep, setCurrentStep] = useState<ProductFormStep>(1)
  /** Prevents Enter-from-step-2 from immediately activating the newly mounted save button. */
  const [saveArmed, setSaveArmed] = useState(false)
  const saveArmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCurrentStep(1)
    setSaveArmed(false)
    if (saveArmTimeoutRef.current) {
      clearTimeout(saveArmTimeoutRef.current)
      saveArmTimeoutRef.current = null
    }
  }, [resetKey])

  useEffect(() => {
    return () => {
      if (saveArmTimeoutRef.current) clearTimeout(saveArmTimeoutRef.current)
    }
  }, [])

  const canProceedStep1 =
    Boolean(formProduct.name.trim()) && Boolean(formProduct.category.trim())

  const price = Number.parseFloat(formProduct.price_per_unit)
  const canProceedStep2 = Number.isFinite(price) && price > 0

  const goBack = () => {
    setSaveArmed(false)
    if (saveArmTimeoutRef.current) {
      clearTimeout(saveArmTimeoutRef.current)
      saveArmTimeoutRef.current = null
    }
    setCurrentStep((prev) => Math.max(1, prev - 1) as ProductFormStep)
  }

  const goNext = (opts?: { fromKeyboard?: boolean }) => {
    if (currentStep === 1 && !canProceedStep1) {
      toast.error(t('supplierProfile.wizardStepBasicsError'))
      return
    }
    if (currentStep === 2 && !canProceedStep2) {
      toast.error(t('supplierProfile.wizardStepPricingError'))
      return
    }
    const next = Math.min(TOTAL_STEPS, currentStep + 1) as ProductFormStep
    if (next === TOTAL_STEPS) {
      if (saveArmTimeoutRef.current) clearTimeout(saveArmTimeoutRef.current)
      if (opts?.fromKeyboard) {
        // Enter on step 2 can keyup-activate a newly mounted save button; delay arming.
        setSaveArmed(false)
        saveArmTimeoutRef.current = setTimeout(() => {
          setSaveArmed(true)
          saveArmTimeoutRef.current = null
        }, 300)
      } else {
        setSaveArmed(true)
      }
    }
    setCurrentStep(next)
  }

  const handleSave = () => {
    if (!saveArmed || formSaving) return
    if (!canProceedStep1) {
      toast.error(t('supplierProfile.wizardStepBasicsError'))
      setCurrentStep(1)
      return
    }
    if (!canProceedStep2) {
      toast.error(t('supplierProfile.wizardStepPricingError'))
      setCurrentStep(2)
      return
    }
    onSubmit()
  }

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA') return
    // Never let Enter submit the form; advance or ignore instead.
    e.preventDefault()
    if (currentStep < TOTAL_STEPS) goNext({ fromKeyboard: true })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
      }}
      onKeyDown={handleFormKeyDown}
    >
      <ProductFormStepProgress currentStep={currentStep} />

      {currentStep === 1 ? (
        <ProductBasicsStep formProduct={formProduct} onChange={onChange} />
      ) : null}
      {currentStep === 2 ? (
        <ProductPricingStep formProduct={formProduct} onChange={onChange} />
      ) : null}
      {currentStep === 3 ? (
        <ProductMediaStep formProduct={formProduct} onChange={onChange} />
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1 || formSaving}
          >
            {t('common.back')}
          </Button>
          {currentStep < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={() => goNext()}
              disabled={
                (currentStep === 1 && !canProceedStep1) ||
                (currentStep === 2 && !canProceedStep2)
              }
            >
              {t('common.continue')}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSave}
              disabled={formSaving || !saveArmed}
            >
              {formSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {submittingLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
