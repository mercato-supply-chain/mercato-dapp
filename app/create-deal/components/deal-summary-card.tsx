'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPercent, formatUSDC } from '@/lib/format'
import { ProductImage } from '@/components/media/product-image'
import { SupplierLogo } from '@/components/suppliers/supplier-logo'
import type { CreateDealFormData } from '../types'
import { useI18n } from '@/lib/i18n/provider'

interface DealSummaryCardProps {
  formData: Pick<CreateDealFormData, 'supplierName' | 'term' | 'fundingWindowDays'>
  productName: string
  productImageUrl?: string | null
  supplierLogoUrl?: string | null
  totalAmount: number
  fundingTotal: number
  feeAmount: number
  platformFeePercent: number
  yieldAPR?: number
  estimatedEarnings?: number
}

export function DealSummaryCard({
  formData,
  productName,
  productImageUrl,
  supplierLogoUrl,
  totalAmount,
  fundingTotal,
  feeAmount,
  platformFeePercent,
  yieldAPR,
  estimatedEarnings,
}: DealSummaryCardProps) {
  const { t } = useI18n()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('createDeal.summaryTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          {productImageUrl ? (
            <ProductImage imageUrl={productImageUrl} alt={productName || 'Product'} size="sm" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{t('createDeal.summaryProduct')}</p>
            <p className="font-medium">{productName || t('createDeal.summaryNotSet')}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('createDeal.summarySupplierReceives')}</p>
          <p className="text-2xl font-bold tabular-nums">
            {totalAmount > 0 ? formatUSDC(totalAmount) : formatUSDC(0)}
          </p>
          <p className="text-xs text-muted-foreground">{t('createDeal.summaryInvoice')}</p>
        </div>
        {totalAmount > 0 ? (
          <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {t('createDeal.summaryPlatformFee', { percent: platformFeePercent })}
              </span>
              <span className="tabular-nums">{formatUSDC(feeAmount)}</span>
            </div>
            <div className="flex justify-between gap-2 font-medium">
              <span>{t('createDeal.summaryInvestorPays')}</span>
              <span className="tabular-nums">{formatUSDC(fundingTotal)}</span>
            </div>
          </div>
        ) : null}
        <div className="flex items-start gap-3">
          <SupplierLogo
            logoUrl={supplierLogoUrl}
            companyName={formData.supplierName || 'Supplier'}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{t('createDeal.summarySupplier')}</p>
            <p className="font-medium">{formData.supplierName || t('createDeal.summaryNotSet')}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('createDeal.summaryTerm')}</p>
          <p className="font-medium">
            {formData.term} {t('common.days')}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('createDeal.summaryFundingWindow')}</p>
          <p className="font-medium">
            {formData.fundingWindowDays
              ? `${formData.fundingWindowDays} ${t('common.days')}`
              : t('createDeal.summaryNotSet')}
          </p>
        </div>
        {yieldAPR != null && totalAmount > 0 && (
          <div>
            <p className="text-sm text-muted-foreground">{t('createDeal.summaryInvestorApr')}</p>
            <p className="font-medium text-success">{yieldAPR.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">
              {t('createDeal.aprLine', {
                apr: yieldAPR.toFixed(2),
                days: formData.term,
              })}
            </p>
          </div>
        )}
        {estimatedEarnings != null && totalAmount > 0 && (
          <div>
            <p className="text-sm text-muted-foreground">
              {t('createDeal.estimatedEarnings')}
            </p>
            <p className="font-medium text-success tabular-nums">
              {formatUSDC(estimatedEarnings)} (
              {formatPercent((estimatedEarnings / totalAmount) * 100, {
                minFractionDigits: 2,
                maxFractionDigits: 2,
              })})
            </p>
            <p className="text-xs text-muted-foreground">
              {t('createDeal.repayEstimate')}:{' '}
              {formatUSDC(totalAmount + estimatedEarnings)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
