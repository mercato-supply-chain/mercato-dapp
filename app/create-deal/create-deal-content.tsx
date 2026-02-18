'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useInitializeEscrow, useSendTransaction } from '@trustless-work/escrow/hooks'
import type { InitializeMultiReleaseEscrowPayload } from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { useWallet } from '@/hooks/use-wallet'
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
} from './types'
import { DealBasicsStep } from './components/deal-basics-step'
import { SupplierStep } from './components/supplier-step'
import { MilestonesStep } from './components/milestones-step'
import { StepProgress } from './components/step-progress'
import { DealSummaryCard } from './components/deal-summary-card'
import { HowItWorksCard } from './components/how-it-works-card'

export default function CreateDealContent() {
  const router = useRouter()
  const supabase = createClient()
  const { deployEscrow } = useInitializeEscrow()
  const { sendTransaction } = useSendTransaction()
  const { walletInfo, isConnected, handleConnect } = useWallet()
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
            'id, supplier_id, name, category, price_per_unit, description, supplier:supplier_companies(id, company_name, address, owner_id)'
          )
          .order('category')
        const raw = (productsResult.data ?? []) as Array<{
          id: string
          supplier_id: string
          name: string
          category: string
          price_per_unit: number
          description?: string | null
          supplier?: { id: string; company_name?: string; address?: string; owner_id?: string } | null
        }>
        const ownerIds = [...new Set(raw.map((p) => p.supplier?.owner_id).filter(Boolean))] as string[]
        const { data: ownerProfiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', ownerIds.length ? ownerIds : ['00000000-0000-0000-0000-000000000000'])
        const emailByOwner: Record<string, string> = {}
        for (const p of ownerProfiles ?? []) {
          emailByOwner[p.id] = p.email ?? ''
        }
        products = raw.map((p) => ({
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
      return sup ? { id: sid, company_name: sup.company_name ?? '', email: sup.email, address: sup.address } : null
    })
    .filter(Boolean) as { id: string; company_name: string; email?: string; address?: string }[]

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
  const estimatedYield = totalAmount * 0.12 * (Number(formData.term) / 365)

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
  const canProceedStep2 = Boolean(formData.supplierName && formData.term)
  const canSubmit = canProceedStep1 && canProceedStep2

  const handleSubmit = async () => {
    if (!userId || !userProfile) return

    if (!isConnected || !walletInfo?.address) {
      toast.error('Please connect your Stellar wallet before creating a deal.')
      return
    }
    const signerAddress = walletInfo.address

    if (!MERCATO_PLATFORM_ADDRESS) {
      toast.error('Platform address is not configured. Contact support.')
      return
    }
    if (!USDC_TRUSTLINE.address) {
      toast.error(
        'Trustline address is not configured (NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS).'
      )
      return
    }

    if (!selectedProduct) {
      toast.error('Please select a product.')
      return
    }

    setIsLoading(true)
    try {
      const { data: company } = await supabase
        .from('supplier_companies')
        .select('id, address, owner_id')
        .eq('id', formData.supplierId)
        .single()

      const supplierAddress = company?.address?.trim()
      if (!supplierAddress) {
        toast.error(
          'Selected supplier company does not have a Stellar wallet address. Ask the supplier to add it in Settings.'
        )
        setIsLoading(false)
        return
      }

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', company?.owner_id)
        .single()

      const productName = selectedProduct.name
      const productUnitPrice = Number(selectedProduct.price_per_unit)

      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          pyme_id: userId,
          title: productName,
          description: formData.description || selectedProduct.description || 'No description provided',
          product_name: productName,
          product_quantity: Number(formData.quantity),
          product_unit_price: productUnitPrice,
          amount: totalAmount,
          term_days: Number(formData.term),
          interest_rate: 12,
          category: formData.category || selectedProduct.category || 'other',
          status: 'seeking_funding',
          supplier_id: formData.supplierId,
          supplier_name: formData.supplierName,
          supplier_email: ownerProfile?.email ?? null,
          supplier_contact: formData.supplierContact || null,
          platform_fee: 2.5,
        })
        .select()
        .single()

      if (dealError) throw dealError

      const milestone1Amount =
        (totalAmount * Number(formData.milestone1Percentage)) / 100
      const milestone2Amount =
        (totalAmount * Number(formData.milestone2Percentage)) / 100

      const milestones = [
        {
          deal_id: deal.id,
          title: formData.milestone1Name,
          description: `${formData.milestone1Name} — ${formData.milestone1Percentage}% of deal amount`,
          percentage: Number(formData.milestone1Percentage),
          amount: milestone1Amount,
          status: 'pending',
        },
        {
          deal_id: deal.id,
          title: formData.milestone2Name,
          description: `${formData.milestone2Name} — ${formData.milestone2Percentage}% of deal amount`,
          percentage: Number(formData.milestone2Percentage),
          amount: milestone2Amount,
          status: 'pending',
        },
      ]

      const { error: milestonesError } = await supabase
        .from('milestones')
        .insert(milestones)

      if (milestonesError) throw milestonesError

      const payload: InitializeMultiReleaseEscrowPayload = {
        signer: signerAddress,
        engagementId: deal.id,
        title: productName,
        description: formData.description || selectedProduct.description || 'No description provided',
        roles: {
          approver: signerAddress,
          serviceProvider: supplierAddress,
          platformAddress: MERCATO_PLATFORM_ADDRESS,
          releaseSigner: MERCATO_PLATFORM_ADDRESS,
          disputeResolver: MERCATO_PLATFORM_ADDRESS,
        },
        platformFee: 2.5,
        trustline: {
          address: USDC_TRUSTLINE.address,
          symbol: USDC_TRUSTLINE.symbol,
        },
        milestones: milestones.map((m) => ({
          description: m.title,
          amount: Math.round(m.amount * 100) / 100, // human-readable (e.g. 100 for $100 USDC); API applies decimals
          receiver: supplierAddress,
        })),
      }

      const deployResponse = await deployEscrow(payload, 'multi-release')

      if (
        deployResponse.status !== 'SUCCESS' ||
        !deployResponse.unsignedTransaction
      ) {
        throw new Error('Failed to create escrow transaction')
      }

      const signedXdr = await signTransaction({
        unsignedTransaction: deployResponse.unsignedTransaction,
        address: signerAddress,
      })

      if (!signedXdr) {
        throw new Error('Signed transaction is missing.')
      }

      const txResult = await sendTransaction(signedXdr)

      if (txResult.status === 'SUCCESS') {
        const escrowResponse = txResult as {
          contractId?: string
          escrow?: { contractId?: string }
        }
        const contractId =
          escrowResponse.contractId ?? escrowResponse.escrow?.contractId

        await supabase
          .from('deals')
          .update({
            escrow_id: deal.id,
            escrow_contract_address: contractId ?? null,
            escrow_status: 'initialized',
          })
          .eq('id', deal.id)

        toast.success('Deal created and escrow deployed successfully!')
        router.push('/dashboard')
      } else {
        throw new Error(
          'message' in txResult
            ? (txResult as { message: string }).message
            : 'Failed to submit transaction'
        )
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Please try again.'
      console.error('Error creating deal:', error)
      toast.error(`Error creating deal: ${message}`)
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
            For PyMEs
          </Badge>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">
            Create New Deal
          </h1>
          <p className="text-lg text-muted-foreground">
            Set up your purchase order and let investors fund it through secure
            escrow
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
                onUpdate={updateFormData}
                onSupplierSelect={handleSupplierSelect}
              />
            )}
            {currentStep === 3 && (
              <MilestonesStep
                formData={formData}
                totalAmount={totalAmount}
                onUpdate={updateFormData}
              />
            )}

            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={goBack}
                disabled={currentStep === 1}
                type="button"
              >
                Back
              </Button>

              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={
                    currentStep === 1 ? !canProceedStep1 : !canProceedStep2
                  }
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Button>
              ) : isConnected ? (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || isLoading}
                >
                  {isLoading
                    ? 'Creating Deal & Deploying Escrow…'
                    : 'Create Deal & Deploy Escrow'}
                </Button>
              ) : (
                <Button type="button" onClick={handleConnect}>
                  Connect Wallet to Continue
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <DealSummaryCard
              formData={formData}
              productName={selectedProduct?.name ?? ''}
              totalAmount={totalAmount}
            />
            <HowItWorksCard />
          </div>
        </div>
      </main>
    </div>
  )
}
