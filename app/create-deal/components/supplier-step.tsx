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
import { Input } from '@/components/ui/input'
import type { CreateDealFormData } from '../types'

interface SupplierOption {
  id: string
  company_name: string
  email?: string
  address?: string
}

interface SupplierStepProps {
  formData: Pick<
    CreateDealFormData,
    | 'supplierId'
    | 'supplierName'
    | 'supplierContact'
    | 'term'
    | 'fundingWindowDays'
    | 'category'
    | 'yieldBonusApr'
  >
  filteredSuppliers: SupplierOption[]
  totalAmount: number
  estimatedYield: number
  baseAPR?: number
  effectiveAPR?: number
  yieldBonusApr: number
  maxYieldBonusApr: number
  onUpdate: (field: keyof CreateDealFormData, value: string) => void
  onSupplierSelect: (supplierId: string) => void
}

export function SupplierStep({
  formData,
  filteredSuppliers,
  totalAmount,
  estimatedYield,
  baseAPR,
  effectiveAPR,
  yieldBonusApr,
  maxYieldBonusApr,
  onUpdate,
  onSupplierSelect,
}: SupplierStepProps) {
  const fundingWindowPresetValues = ['3', '7', '14']
  const isCustomFundingWindow =
    formData.fundingWindowDays === '' ||
    !fundingWindowPresetValues.includes(formData.fundingWindowDays)

  const rawBonusInput =
    parseFloat(String(formData.yieldBonusApr).replace(',', '.')) || 0
  const showBonusCapHint =
    Number.isFinite(rawBonusInput) && rawBonusInput > maxYieldBonusApr

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

        <div className="space-y-2">
          <Label htmlFor="funding-window">Funding Window (Days) *</Label>
          <Select
            value={
              isCustomFundingWindow
                ? 'custom'
                : formData.fundingWindowDays
            }
            onValueChange={(v) => {
              if (v === 'custom') {
                onUpdate('fundingWindowDays', '')
                return
              }
              onUpdate('fundingWindowDays', v)
            }}
          >
            <SelectTrigger id="funding-window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {(formData.fundingWindowDays === '' || isCustomFundingWindow) && (
            <div className="flex items-center gap-2">
              <Input
                id="funding-window-custom"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                step={1}
                placeholder="e.g. 10"
                value={formData.fundingWindowDays}
                onChange={(e) => onUpdate('fundingWindowDays', e.target.value)}
                className="max-w-[140px] tabular-nums"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Investors can fund this deal until the funding deadline. After that,
            it expires unless you extend it before funding.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="yield-bonus-apr">
            Additional investor yield (optional)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="yield-bonus-apr"
              type="number"
              inputMode="decimal"
              min={0}
              max={maxYieldBonusApr}
              step={0.25}
              value={formData.yieldBonusApr}
              onChange={(e) => onUpdate('yieldBonusApr', e.target.value)}
              className="max-w-[140px] tabular-nums"
            />
            <span className="text-sm text-muted-foreground">% APR</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Extra percentage points on top of the base rate (from term and deal
            size), up to {maxYieldBonusApr}% — increases what you repay but makes
            the deal more attractive to investors
          </p>
          {showBonusCapHint && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Applied bonus is capped at {maxYieldBonusApr}% APR.
            </p>
          )}
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
            {baseAPR != null && effectiveAPR != null && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Base {baseAPR.toFixed(1)}% APR (from {formData.term} days and
                  deal amount)
                  {yieldBonusApr > 0 && (
                    <span className="text-foreground">
                      {' '}
                      + {yieldBonusApr.toFixed(2)}% PyME bonus →{' '}
                      <span className="font-medium text-success">
                        {effectiveAPR.toFixed(2)}% APR
                      </span>{' '}
                      total
                    </span>
                  )}
                </p>
              </div>
            )}
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
