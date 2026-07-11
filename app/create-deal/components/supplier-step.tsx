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
import { formatPercent, formatUSDC } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { SupplierLogo } from '@/components/suppliers/supplier-logo'
import type { CreateDealFormData } from '../types'
import { useI18n } from '@/lib/i18n/provider'

interface SupplierOption {
  id: string
  company_name: string
  email?: string
  address?: string
  logo_url?: string | null
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
  >
  filteredSuppliers: SupplierOption[]
  totalAmount: number
  estimatedEarnings: number
  yieldAPR?: number
  onUpdate: (field: keyof CreateDealFormData, value: string) => void
  onSupplierSelect: (supplierId: string) => void
}

export function SupplierStep({
  formData,
  filteredSuppliers,
  totalAmount,
  estimatedEarnings,
  yieldAPR,
  onUpdate,
  onSupplierSelect,
}: SupplierStepProps) {
  const { t } = useI18n()

  const PRESET_FUNDING_WINDOWS = ['3', '7', '14']
  const isCustomFundingWindow =
    formData.fundingWindowDays !== '' &&
    !PRESET_FUNDING_WINDOWS.includes(formData.fundingWindowDays)
  const selectedSupplier = filteredSuppliers.find(s => s.id === formData.supplierId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" aria-hidden />
          {t('createDeal.supplierTermsTitle')}
        </CardTitle>
        <CardDescription>
          {t('createDeal.supplierTermsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="supplier">{t('createDeal.selectSupplierRequired')}</Label>
          <Select
            value={formData.supplierId || undefined}
            onValueChange={onSupplierSelect}
          >
            <SelectTrigger id="supplier">
              <SelectValue
                placeholder={
                  formData.supplierName || t('createDeal.chooseVerifiedSupplier')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {filteredSuppliers.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {formData.category
                    ? t('createDeal.noSuppliersForCategory', { category: formData.category })
                    : t('createDeal.selectCategory')}
                </div>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    <div className="flex items-center gap-2">
                      <SupplierLogo
                        logoUrl={supplier.logo_url}
                        companyName={supplier.company_name}
                        size="xs"
                      />
                      {supplier.company_name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {formData.category && (
            <p className="text-xs text-muted-foreground">
              {t('createDeal.showingSuppliersFor')}{' '}
              <span className="font-medium capitalize">{formData.category}</span>
            </p>
          )}
        </div>

        {formData.supplierName && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">{t('createDeal.selectedSupplier')}</p>
            <div className="flex items-center gap-3">
              <SupplierLogo
                logoUrl={selectedSupplier?.logo_url}
                companyName={formData.supplierName}
                size="sm"
              />
              <div>
                <p className="text-sm font-semibold">{formData.supplierName}</p>
                {formData.supplierContact && (
                  <p className="text-xs text-muted-foreground">
                    {t('createDeal.contact', { contact: formData.supplierContact })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="term">{t('createDeal.dealTerm')}</Label>
          <Select
            value={formData.term}
            onValueChange={(v) => onUpdate('term', v)}
          >
            <SelectTrigger id="term">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 {t('common.days')}</SelectItem>
              <SelectItem value="45">45 {t('common.days')}</SelectItem>
              <SelectItem value="60">60 {t('common.days')}</SelectItem>
              <SelectItem value="75">75 {t('common.days')}</SelectItem>
              <SelectItem value="90">90 {t('common.days')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('createDeal.repayHint')}
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

        {totalAmount > 0 && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('createDeal.dealAmount')}</span>
              <span className="font-semibold tabular-nums">
                {formatUSDC(totalAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('createDeal.estimatedEarnings')}
              </span>
              <span className="font-semibold text-success tabular-nums">
                {formatUSDC(estimatedEarnings)} (
                {formatPercent((estimatedEarnings / totalAmount) * 100, {
                  minFractionDigits: 2,
                  maxFractionDigits: 2,
                })})
              </span>
            </div>
            {yieldAPR != null && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  {t('createDeal.aprLine', {
                    apr: yieldAPR.toFixed(2),
                    days: formData.term,
                  })}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('createDeal.repayEstimate')}
              </span>
              <span className="font-semibold tabular-nums">
                {formatUSDC(totalAmount + estimatedEarnings)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
