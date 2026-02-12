'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { CreateDealFormData, CreateDealSupplier } from '../types'

interface SupplierStepProps {
  formData: Pick<
    CreateDealFormData,
    'supplierId' | 'supplierName' | 'supplierContact' | 'term' | 'category'
  >
  filteredSuppliers: CreateDealSupplier[]
  totalAmount: number
  estimatedYield: number
  onUpdate: (field: keyof CreateDealFormData, value: string) => void
  onSupplierSelect: (supplierId: string) => void
}

export function SupplierStep({
  formData,
  filteredSuppliers,
  totalAmount,
  estimatedYield,
  onUpdate,
  onSupplierSelect,
}: SupplierStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" aria-hidden />
          Supplier & Terms
        </CardTitle>
        <CardDescription>
          Who will supply the product and what are the payment terms?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="supplier">Select Supplier *</Label>
          <Select
            value={formData.supplierId || undefined}
            onValueChange={onSupplierSelect}
          >
            <SelectTrigger id="supplier">
              <SelectValue
                placeholder={
                  formData.supplierName || 'Choose from verified suppliers'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {filteredSuppliers.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {formData.category
                    ? `No suppliers found for ${formData.category}`
                    : 'Select a category first to see suppliers'}
                </div>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.company_name}
                    {supplier.products && supplier.products.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {' '}
                        • {supplier.products.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {formData.category && (
            <p className="text-xs text-muted-foreground">
              Showing suppliers for:{' '}
              <span className="font-medium capitalize">{formData.category}</span>
            </p>
          )}
        </div>

        {formData.supplierName && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-1 text-sm font-medium">Selected Supplier</p>
            <p className="text-sm text-muted-foreground">
              {formData.supplierName}
            </p>
            {formData.supplierContact && (
              <p className="mt-1 text-xs text-muted-foreground">
                Contact: {formData.supplierContact}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="term">Deal Term (Days) *</Label>
          <Select
            value={formData.term}
            onValueChange={(v) => onUpdate('term', v)}
          >
            <SelectTrigger id="term">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="45">45 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="75">75 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This is how long you have to repay investors after delivery
          </p>
        </div>

        {totalAmount > 0 && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Deal Amount</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Estimated Investor Yield
              </span>
              <span className="font-semibold text-success tabular-nums">
                {formatCurrency(estimatedYield)} (
                {formatPercent((estimatedYield / totalAmount) * 100)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                You Repay (estimate)
              </span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(totalAmount + estimatedYield)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
