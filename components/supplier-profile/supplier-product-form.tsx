'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ProductFormState } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'
import { TOTAL_STEPS, type ProductFormStep } from './product-form-steps/types'
import { ProductFormStepProgress } from './product-form-steps/product-form-step-progress'
import { ProductBasicsStep } from './product-form-steps/product-basics-step'
import { ProductPricingStep } from './product-form-steps/product-pricing-step'
import { ProductMediaStep } from './product-form-steps/product-media-step'

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
