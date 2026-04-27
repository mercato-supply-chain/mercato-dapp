'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { CreateDealFormData } from '../types'

interface DealSummaryCardProps {
  formData: Pick<CreateDealFormData, 'supplierName' | 'term' | 'fundingWindowDays'>
  productName: string
  totalAmount: number
  baseAPR?: number
  effectiveAPR?: number
  yieldBonusApr: number
}

export function DealSummaryCard({
  formData,
  productName,
  totalAmount,
  baseAPR,
  effectiveAPR,
  yieldBonusApr,
}: DealSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deal Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Product</p>
          <p className="font-medium">{productName || 'Not set'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold tabular-nums">
            {totalAmount > 0 ? formatCurrency(totalAmount) : formatCurrency(0)}
          </p>
          <p className="text-xs text-muted-foreground">USDC</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Supplier</p>
          <p className="font-medium">{formData.supplierName || 'Not set'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Term</p>
          <p className="font-medium">{formData.term} days</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Funding Window</p>
          <p className="font-medium">
            {formData.fundingWindowDays || 'Not set'} days
          </p>
        </div>
        {effectiveAPR != null && baseAPR != null && (
          <div>
            <p className="text-sm text-muted-foreground">Investor yield APR</p>
            <p className="font-medium text-success">{effectiveAPR.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">
              Base {baseAPR.toFixed(1)}% from {formData.term} days and amount
              {yieldBonusApr > 0
                ? ` + ${yieldBonusApr.toFixed(2)}% PyME bonus`
                : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
