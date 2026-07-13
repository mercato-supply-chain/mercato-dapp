'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { StepProgress } from './step-progress'
import { DealBasicsStep } from './deal-basics-step'
import { SupplierStep } from './supplier-step'
import { DealSummaryCard } from './deal-summary-card'
import { HowItWorksCard } from './how-it-works-card'
import { useI18n } from '@/lib/i18n/provider'
import type { FormStep, CreateDealFormData, SupplierProductRow } from '../types'

interface CreateDealFormBodyProps {
  formData: CreateDealFormData
  currentStep: FormStep
  availableCategories: string[]
  filteredSuppliers: { id: string; company_name: string; email?: string; address?: string; logo_url?: string | null }[]
  productsForSupplier: { id: string; name: string; category: string; price_per_unit: number; description?: string | null; image_url?: string | null; unit?: string; stock_quantity?: number; reserved_quantity?: number }[]
  selectedProduct: SupplierProductRow | null | undefined
  totalAmount: number
  fundingTotal: number
  feeAmount: number
  platformFeePercent: number
  yieldAPR: number
  estimatedEarnings: number
  canProceedStep1: boolean
  canProceedStep2: boolean
  canSubmit: boolean
  supplierLogoUrl?: string | null
  productImageUrl?: string | null
  isConnected: boolean
  isSubmitting: boolean
  handleSubmit: () => void
  handleConnect: () => void
  goBack: () => void
  goNext: () => void
  updateFormData: (field: keyof CreateDealFormData, value: string) => void
  handleSupplierSelect: (supplierId: string) => void
  /** Override create-flow copy (edit deal page). */
  copy?: {
    badge: string
    title: string
    description: string
    submit: string
    submitting: string
  }
  /** When false, skip the connect-wallet gate on the final step. */
  requireWallet?: boolean
  showHowItWorks?: boolean
}

export function CreateDealFormBody({
  formData,
  currentStep,
  availableCategories,
  filteredSuppliers,
  productsForSupplier,
  selectedProduct,
  totalAmount,
  fundingTotal,
  feeAmount,
  platformFeePercent,
  yieldAPR,
  estimatedEarnings,
  canProceedStep1,
  canProceedStep2,
  canSubmit,
  supplierLogoUrl,
  productImageUrl,
  isConnected,
  isSubmitting,
  handleSubmit,
  handleConnect,
  goBack,
  goNext,
  updateFormData,
  handleSupplierSelect,
  copy,
  requireWallet = true,
  showHowItWorks = true,
}: CreateDealFormBodyProps) {
  const { t } = useI18n()
  const badge = copy?.badge ?? t('createDeal.badge')
  const title = copy?.title ?? t('createDeal.title')
  const description = copy?.description ?? t('createDeal.description')
  const submitLabel = copy?.submit ?? t('createDeal.create')
  const submittingLabel = copy?.submitting ?? t('createDeal.creating')

  return (
    <>
      <div className="mb-8">
        <Badge className="mb-3" variant="secondary">
          {badge}
        </Badge>
        <h1 className="mb-2 text-4xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="text-lg text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StepProgress currentStep={currentStep} totalSteps={2} />

          {currentStep === 1 && (
            <DealBasicsStep
              formData={formData}
              availableCategories={availableCategories}
              filteredSuppliers={filteredSuppliers}
              productsForSupplier={productsForSupplier}
              totalAmount={totalAmount}
              onUpdate={updateFormData}
              onSupplierSelect={handleSupplierSelect}
            />
          )}
          {currentStep === 2 && (
            <SupplierStep
              formData={formData}
              filteredSuppliers={filteredSuppliers}
              totalAmount={totalAmount}
              estimatedEarnings={estimatedEarnings}
              yieldAPR={totalAmount > 0 ? yieldAPR : undefined}
              onUpdate={updateFormData}
              onSupplierSelect={handleSupplierSelect}
            />
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={currentStep === 1}
              type="button"
            >
              {t('common.back')}
            </Button>

            {currentStep < 2 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={!canProceedStep1}
              >
                {t('common.continue')}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            ) : !requireWallet || isConnected ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? submittingLabel : submitLabel}
              </Button>
            ) : (
              <Button type="button" onClick={handleConnect}>
                {t('createDeal.connectWalletContinue')}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <DealSummaryCard
            formData={formData}
            productName={selectedProduct?.name ?? ''}
            productImageUrl={productImageUrl}
            supplierLogoUrl={supplierLogoUrl}
            totalAmount={totalAmount}
            fundingTotal={fundingTotal}
            feeAmount={feeAmount}
            platformFeePercent={platformFeePercent}
            yieldAPR={totalAmount > 0 ? yieldAPR : undefined}
            estimatedEarnings={totalAmount > 0 ? estimatedEarnings : undefined}
          />
          {showHowItWorks ? <HowItWorksCard /> : null}
        </div>
      </div>
    </>
  )
}
