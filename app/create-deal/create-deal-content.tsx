'use client'

import { useWallet } from '@/hooks/use-wallet'
import { useCreateDealSubmit } from '@/hooks/use-create-deal-submit'
import { useCreateDealInit } from '@/hooks/use-create-deal-init'
import { useCreateDealForm } from '@/hooks/use-create-deal-form'
import { toast } from 'sonner'
import { Navigation } from '@/components/navigation'
import { CreateDealFormBody } from './components/create-deal-form-body'
import { useI18n } from '@/lib/i18n/provider'
import { useRouter } from 'next/navigation'

export default function CreateDealContent() {
  const { t } = useI18n()
  const router = useRouter()
  const { walletInfo, isConnected, handleConnect } = useWallet()
  const { submit, isSubmitting } = useCreateDealSubmit()
  const { userId, supplierProducts } = useCreateDealInit()
  const form = useCreateDealForm(supplierProducts)

  const handleSubmit = async () => {
    if (!isConnected || !walletInfo?.address) {
      toast.error(t('createDeal.walletRequired'))
      return
    }
    if (!form.selectedProduct) {
      toast.error(t('createDeal.selectProduct'))
      return
    }
    if (!form.isFundingWindowValid) {
      toast.error('Set a valid funding window in days before creating the deal.')
      return
    }

    const result = await submit({
      userId,
      signerAddress: walletInfo.address,
      supplierId: form.formData.supplierId,
      productName: form.selectedProduct.name,
      description: form.formData.description || form.selectedProduct.description || t('createDeal.missingDescription'),
      productQuantity: Number(form.formData.quantity),
      productUnitPrice: Number(form.selectedProduct.price_per_unit),
      totalAmount: form.totalAmount,
      termDays: Number(form.formData.term),
      effectiveAPR: form.yieldAPR,
      yieldBonusApr: 0,
      category: form.formData.category || form.selectedProduct.category || 'other',
      supplierName: form.formData.supplierName,
      supplierContact: form.formData.supplierContact || null,
      fundingWindowDays: form.fundingWindowDays,
    })

    if (result.ok) {
      toast.success(t('createDeal.success'))
      router.push('/dashboard')
    } else {
      toast.error(t('createDeal.errorPrefix', { message: result.error }))
    }
  }

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
        <CreateDealFormBody
          formData={form.formData}
          currentStep={form.currentStep}
          availableCategories={form.availableCategories}
          filteredSuppliers={form.filteredSuppliers}
          productsForSupplier={form.productsForSupplier}
          selectedProduct={form.selectedProduct}
          totalAmount={form.totalAmount}
          fundingTotal={form.fundingTotal}
          feeAmount={form.feeAmount}
          platformFeePercent={form.platformFeePercent}
          yieldAPR={form.yieldAPR}
          estimatedEarnings={form.estimatedEarnings}
          canProceedStep1={form.canProceedStep1}
          canProceedStep2={form.canProceedStep2}
          canSubmit={form.canSubmit}
          supplierLogoUrl={form.supplierLogoUrl}
          productImageUrl={form.selectedProduct?.image_url}
          isConnected={isConnected}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
          handleConnect={handleConnect}
          goBack={form.goBack}
          goNext={form.goNext}
          updateFormData={form.updateFormData}
          handleSupplierSelect={form.handleSupplierSelect}
        />
      </main>
    </div>
  )
}
