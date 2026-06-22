'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useWallet } from '@/hooks/use-wallet'
import { useCreateDealSubmit } from '@/hooks/use-create-deal-submit'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { toast } from 'sonner'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
import {
  DEFAULT_FORM_DATA,
  type CreateDealFormData,
  type CreateDealProfile,
  type SupplierProductRow,
  type FormStep,
  isMilestonesValid,
} from './types'
import { DealBasicsStep } from './components/deal-basics-step'
import { SupplierStep } from './components/supplier-step'
import { MilestonesStep } from './components/milestones-step'
import { StepProgress } from './components/step-progress'
import { DealSummaryCard } from './components/deal-summary-card'
import { HowItWorksCard } from './components/how-it-works-card'
import {
  calculateYieldAPR,
  calculateYieldAmount,
  clampYieldBonusApr,
  effectiveInvestorApr,
  MAX_YIELD_BONUS_APR,
} from '@/lib/yield'
import { useI18n } from '@/lib/i18n/provider'

export default function CreateDealContent() {
  const { t } = useI18n()
  const router = useRouter()
  const supabase = createClient()
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()
  const { createDealAndEscrow } = useCreateDealSubmit()
  const [currentStep, setCurrentStep] = useState<FormStep>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<CreateDealProfile | null>(null)
  const [supplierProducts, setSupplierProducts] = useState<SupplierProductRow[]>([])
  const [formData, setFormData] = useState<CreateDealFormData>(DEFAULT_FORM_DATA)

  useEffect(() => {
    const init = async () => {
      const authResult = supabase.auth.getUser()
      let products: SupplierProductRow[] = []
      try {
        const res = await fetch('/api/catalog')
        if (res.ok) {
          const data = await res.json()
          products = data as SupplierProductRow[]
        }
      } catch {
        // fallback: load via client (requires RLS policy supplier_products_select_all)
      }
      if (products.length === 0) {
        const productsResult = await supabase
          .from('supplier_products')
          .select(
            'id, supplier_id, name, category, price_per_unit, description, image_url, sku, unit, stock_quantity, reserved_quantity, reorder_point, supplier:supplier_companies(id, company_name, address, owner_id, logo_url)'
          )
          .order('category')
        const raw = (productsResult.data as any) || []
        const ownerIds = [...new Set(raw.map((p: any) => p.supplier?.owner_id).filter(Boolean))] as string[]
        const { data: ownerProfiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', ownerIds.length ? ownerIds : ['00000000-0000-0000-0000-000000000000'])
        const emailByOwner: Record<string, string> = {}
        for (const p of ownerProfiles ?? []) {
          emailByOwner[p.id] = p.email ?? ''
        }
        products = raw.map((p: any) => ({
          ...p,
          supplier: p.supplier
            ? { ...p.supplier, email: emailByOwner[p.supplier.owner_id ?? ''] }
            : p.supplier,
        })) as unknown as SupplierProductRow[]
      }
      setSupplierProducts(products)
      const { data: { user } } = await authResult
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setUserProfile(profile as CreateDealProfile)
    }
    init()
  }, [router, supabase])

  const availableCategories = Array.from(
    new Set(supplierProducts.map((p) => p.category).filter(Boolean))
  ).sort()

  const supplierIdsInCategory = formData.category
    ? [...new Set(supplierProducts.filter((p) => p.category === formData.category).map((p) => p.supplier_id))]
    : [...new Set(supplierProducts.map((p) => p.supplier_id))]

  const filteredSuppliers = supplierIdsInCategory
    .map((sid) => {
      const product = supplierProducts.find((p) => p.supplier_id === sid)
      const sup = product?.supplier
      return sup ? { id: sid, company_name: sup.company_name ?? '', email: sup.email, address: sup.address, logo_url: sup.logo_url } : null
    })
    .filter(Boolean) as { id: string; company_name: string; email?: string; address?: string; logo_url?: string | null }[]

  const productsForSupplier = formData.supplierId
    ? supplierProducts.filter(
        (p) => p.supplier_id === formData.supplierId && (!formData.category || p.category === formData.category)
      )
    : []

  const selectedProduct = formData.productId
    ? supplierProducts.find((p) => p.id === formData.productId)
    : null

  const totalAmount =
    selectedProduct && formData.quantity
      ? Number(formData.quantity) * Number(selectedProduct.price_per_unit)
      : 0
  const termDays = Number(formData.term || 60)
  const parsedBonus = parseFloat(
    String(formData.yieldBonusApr ?? '0').replace(',', '.')
  )
  const yieldBonusApr = clampYieldBonusApr(
    Number.isFinite(parsedBonus) ? parsedBonus : 0
  )
  const baseAPR =
    totalAmount > 0 ? calculateYieldAPR(termDays, totalAmount) : 0
  const effectiveAPR =
    totalAmount > 0 ? effectiveInvestorApr(baseAPR, yieldBonusApr) : 0
  const estimatedYield =
    totalAmount > 0
      ? calculateYieldAmount(totalAmount, termDays, effectiveAPR)
      : 0

  const updateFormData = (field: keyof CreateDealFormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'category') {
        next.supplierId = ''
        next.supplierName = ''
        next.supplierContact = ''
        next.productId = ''
      } else if (field === 'supplierId') {
        next.productId = ''
      }
      return next
    })
  }

  const handleSupplierSelect = (supplierId: string) => {
    const product = supplierProducts.find((p) => p.supplier_id === supplierId)
    const sup = product?.supplier
    if (sup) {
      setFormData((prev) => ({
        ...prev,
        supplierId,
        supplierName: sup.company_name ?? '',
        supplierContact: sup.email ?? sup.address ?? '',
        productId: '',
      }))
    }
  }

  const canProceedStep1 =
    Boolean(formData.category || availableCategories.length === 0) &&
    Boolean(formData.supplierId && formData.productId && formData.quantity)
  const fundingWindowDays = Number(formData.fundingWindowDays)
  const isFundingWindowValid =
    Number.isInteger(fundingWindowDays) && fundingWindowDays > 0
  const canProceedStep2 =
    Boolean(formData.supplierName && formData.term) && isFundingWindowValid
  const milestonesOk = isMilestonesValid(formData.milestones)
  const canSubmit = canProceedStep1 && canProceedStep2 && milestonesOk

  const handleSubmit = async () => {
    if (!userId || !userProfile) return

    if (!isConnected || !walletInfo?.address) {
      toast.error(t('createDeal.walletRequired'))
      return
    }
    const signerAddress = walletInfo.address

    if (!MERCATO_PLATFORM_ADDRESS) {
      toast.error(t('createDeal.platformMissing'))
      return
    }
    if (!USDC_TRUSTLINE.address) {
      toast.error(
        t('createDeal.trustlineMissing')
      )
      return
    }

    if (!selectedProduct) {
      toast.error(t('createDeal.selectProduct'))
      return
    }

    if (!isMilestonesValid(formData.milestones)) {
      toast.error(
        t('createDeal.invalidMilestones'),
      )
      return
    }

    if (!isFundingWindowValid) {
      toast.error('Set a valid funding window in days before creating the deal.')
      return
    }

    setIsLoading(true)
    try {
      const { dealId, contractId } = await createDealAndEscrow({
        userId,
        signerAddress,
        supplierId: formData.supplierId,
        productName: selectedProduct.name,
        description: formData.description || selectedProduct.description || t('createDeal.missingDescription'),
        productQuantity: Number(formData.quantity),
        productUnitPrice: Number(selectedProduct.price_per_unit),
        totalAmount,
        termDays: Number(formData.term),
        effectiveAPR,
        yieldBonusApr,
        category: formData.category || selectedProduct.category || 'other',
        supplierName: formData.supplierName,
        supplierContact: formData.supplierContact || null,
        fundingWindowDays,
        milestones: formData.milestones,
        provider,
      })

      await supabase
        .from('deals')
        .update({
          escrow_id: dealId,
          escrow_contract_address: contractId ?? null,
          escrow_status: 'initialized',
        })
        .eq('id', dealId)

      toast.success(t('createDeal.success'))
      router.push('/dashboard')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('createDeal.tryAgain')
      console.error('Error creating deal:', error)
      toast.error(t('createDeal.errorPrefix', { message }))
    } finally {
      setIsLoading(false)
    }
  }

  const goBack = () =>
    setCurrentStep((prev) => Math.max(1, prev - 1) as FormStep)
  const goNext = () =>
    setCurrentStep((prev) => Math.min(3, prev + 1) as FormStep)

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <Navigation />
      <main id="main-content" className="container mx-auto px-4 py-8 pb-16">
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
                maxYieldBonusApr={MAX_YIELD_BONUS_APR}
                onUpdate={updateFormData}
                onSupplierSelect={handleSupplierSelect}
              />
            )}
            {currentStep === 3 && (
              <MilestonesStep
                milestones={formData.milestones}
                totalAmount={totalAmount}
                onMilestonesChange={(milestones) =>
                  setFormData((prev) => ({ ...prev, milestones }))
                }
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
                  disabled={!canSubmit || isLoading}
                  title={
                    !milestonesOk
                      ? t('createDeal.invalidMilestones')
                      : undefined
                  }
                >
                  {isLoading
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
              productImageUrl={selectedProduct?.image_url}
              supplierLogoUrl={
                filteredSuppliers.find((s) => s.id === formData.supplierId)?.logo_url ??
                selectedProduct?.supplier?.logo_url
              }
              totalAmount={totalAmount}
              baseAPR={totalAmount > 0 ? baseAPR : undefined}
              effectiveAPR={totalAmount > 0 ? effectiveAPR : undefined}
              yieldBonusApr={yieldBonusApr}
            />
            <HowItWorksCard />
          </div>
        </div>
      </main>
    </div>
  )
}
