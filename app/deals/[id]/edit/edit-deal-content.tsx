'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { CreateDealFormBody } from '@/app/create-deal/components/create-deal-form-body'
import { useCreateDealForm } from '@/hooks/use-create-deal-form'
import { useCreateDealInit } from '@/hooks/use-create-deal-init'
import { useDealDetail } from '@/hooks/use-deal-detail'
import { useEditDealSubmit } from '@/hooks/use-edit-deal-submit'
import { canEditDeal, dealToFormData } from '@/lib/deals/edit'
import { useI18n } from '@/lib/i18n/provider'
import { DealDetailSkeleton } from '@/components/deals/deal-detail-skeleton'

export default function EditDealContent() {
  const { t } = useI18n()
  const router = useRouter()
  const params = useParams()
  const dealId = typeof params.id === 'string' ? params.id : params.id?.[0]

  const {
    deal,
    isLoading: isDealLoading,
    userId,
    isPyme,
    isAdmin,
  } = useDealDetail(dealId)

  const { supplierProducts, isReady: isCatalogReady } = useCreateDealInit({
    redirectIfUnauthenticated: true,
  })
  const { submit, isSubmitting } = useEditDealSubmit()

  const allowed = Boolean(
    deal &&
      canEditDeal(deal, {
        userId,
        isPyme,
        isAdmin,
      }),
  )

  const initialFormData = useMemo(() => {
    if (!deal || !isCatalogReady || !allowed) return null
    return dealToFormData(deal, supplierProducts)
  }, [allowed, deal, isCatalogReady, supplierProducts])

  const form = useCreateDealForm(supplierProducts, initialFormData)

  const handleSubmit = async () => {
    if (!deal || !userId) return
    if (!form.selectedProduct) {
      toast.error(t('createDeal.selectProduct'))
      return
    }
    if (!form.isFundingWindowValid) {
      toast.error(t('editDeal.invalidFundingWindow'))
      return
    }

    const result = await submit({
      dealId: deal.id,
      userId,
      isAdmin,
      supplierId: form.formData.supplierId,
      productName: form.selectedProduct.name,
      description:
        form.formData.description ||
        form.selectedProduct.description ||
        t('createDeal.missingDescription'),
      productQuantity: Number(form.formData.quantity),
      productUnitPrice: Number(form.selectedProduct.price_per_unit),
      totalAmount: form.totalAmount,
      termDays: Number(form.formData.term),
      effectiveAPR: form.yieldAPR,
      yieldBonusApr: deal.yieldBonusApr ?? 0,
      category: form.formData.category || form.selectedProduct.category || 'other',
      supplierName: form.formData.supplierName,
      supplierContact: form.formData.supplierContact || null,
      fundingWindowDays: form.fundingWindowDays,
      previousFundingWindowDays: deal.fundingWindowDays,
    })

    if (result.ok) {
      toast.success(t('editDeal.success'))
      router.push(`/deals/${deal.id}`)
      router.refresh()
    } else {
      toast.error(t('editDeal.errorPrefix', { message: result.error }))
    }
  }

  if (isDealLoading || !isCatalogReady) {
    return <DealDetailSkeleton />
  }

  if (!deal) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold">{t('deals.noDeals')}</h1>
            <p className="mb-4 text-muted-foreground">{t('dealDetail.notFoundHelp')}</p>
            <Button asChild>
              <Link href="/deals">{t('common.back')}</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto flex flex-1 items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="mb-2 text-2xl font-bold">{t('editDeal.notAllowedTitle')}</h1>
            <p className="mb-4 text-muted-foreground">
              {isDealUnfundedMessage(deal, t)}
            </p>
            <Button asChild>
              <Link href={`/deals/${deal.id}`}>{t('editDeal.backToDeal')}</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main className="container mx-auto px-4 py-8 pb-16">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/deals/${deal.id}`}>{t('editDeal.backToDeal')}</Link>
          </Button>
        </div>
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
          isConnected
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
          handleConnect={() => undefined}
          goBack={form.goBack}
          goNext={form.goNext}
          updateFormData={form.updateFormData}
          handleSupplierSelect={form.handleSupplierSelect}
          requireWallet={false}
          showHowItWorks={false}
          copy={{
            badge: t('editDeal.badge'),
            title: t('editDeal.title'),
            description: t('editDeal.description'),
            submit: t('editDeal.save'),
            submitting: t('editDeal.saving'),
          }}
        />
      </main>
    </div>
  )
}

function isDealUnfundedMessage(
  deal: NonNullable<ReturnType<typeof useDealDetail>['deal']>,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const funded =
    Boolean(deal.investorId) ||
    Boolean(deal.fundedAt) ||
    deal.fundingStatus === 'funded' ||
    deal.status !== 'awaiting_funding'
  if (funded) return t('editDeal.lockedAfterFunding')
  return t('editDeal.notAllowedBody')
}
