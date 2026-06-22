'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { StepProgress } from './step-progress'
import { DealBasicsStep } from './deal-basics-step'
import { SupplierStep } from './supplier-step'
import { MilestonesStep } from './milestones-step'
import { DealSummaryCard } from './deal-summary-card'
import { HowItWorksCard } from './how-it-works-card'
import { useI18n } from '@/lib/i18n/provider'
import type { FormStep, MilestoneDraft, CreateDealFormData, SupplierProductRow } from '../types'

interface CreateDealFormBodyProps {
  formData: CreateDealFormData
  currentStep: FormStep
  availableCategories: string[]
  filteredSuppliers: { id: string; company_name: string; email?: string; address?: string; logo_url?: string | null }[]
  productsForSupplier: { id: string; name: string; category: string; price_per_unit: number; description?: string | null; image_url?: string | null; unit?: string; stock_quantity?: number; reserved_quantity?: number }[]
  selectedProduct: SupplierProductRow | null | undefined
  totalAmount: number
  baseAPR: number
  effectiveAPR: number
  estimatedYield: number
  yieldBonusApr: number
  maxYieldBonusApr: number
  canProceedStep1: boolean
  canProceedStep2: boolean
  milestonesOk: boolean
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
  onMilestonesChange: (milestones: MilestoneDraft[]) => void
}

export function CreateDealFormBody({
  formData,
  currentStep,
  availableCategories,
  filteredSuppliers,
  productsForSupplier,
  selectedProduct,
  totalAmount,
  baseAPR,
  effectiveAPR,
  estimatedYield,
  yieldBonusApr,
  maxYieldBonusApr,
  canProceedStep1,
  canProceedStep2,
  milestonesOk,
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
  onMilestonesChange,
}: CreateDealFormBodyProps) {
  const { t } = useI18n()

  return (
    <>
      <div className="mb-8">
        <Badge className="mb-3" variant="secondary">
          {t('createDeal.badge')}
        </Badge>
        <h1 className="mb-2 text-4xl font-bold tracking-tight">
          {t('createDeal.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('createDeal.description')}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StepProgress currentStep={currentStep} />

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
              estimatedYield={estimatedYield}
              baseAPR={totalAmount > 0 ? baseAPR : undefined}
              effectiveAPR={totalAmount > 0 ? effectiveAPR : undefined}
              yieldBonusApr={yieldBonusApr}
              maxYieldBonusApr={maxYieldBonusApr}
              onUpdate={updateFormData}
              onSupplierSelect={handleSupplierSelect}
            />
          )}
          {currentStep === 3 && (
            <MilestonesStep
              milestones={formData.milestones ?? []}
              totalAmount={totalAmount}
              onMilestonesChange={onMilestonesChange}
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

            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={
                  currentStep === 1 ? !canProceedStep1 : !canProceedStep2
                }
              >
                {t('common.continue')}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            ) : isConnected ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                title={
                  !milestonesOk
                    ? t('createDeal.invalidMilestones')
                    : undefined
                }
              >
                {isSubmitting
                  ? t('createDeal.creatingDeploying')
                  : t('createDeal.createDeploy')}
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
            baseAPR={totalAmount > 0 ? baseAPR : undefined}
            effectiveAPR={totalAmount > 0 ? effectiveAPR : undefined}
            yieldBonusApr={yieldBonusApr}
          />
          <HowItWorksCard />
        </div>
      </div>
    </>
  )
}
