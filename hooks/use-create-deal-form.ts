'use client'

import { useState } from 'react'
import type { CreateDealFormData, SupplierProductRow, FormStep } from '@/app/create-deal/types'
import { DEFAULT_FORM_DATA } from '@/app/create-deal/types'
import {
  calculateYieldAPR,
  calculateYieldAmount,
  clampYieldBonusApr,
  effectiveInvestorApr,
  MAX_YIELD_BONUS_APR,
} from '@/lib/yield'
import {
  investorFundingTotal,
  platformFeeAmount,
  PLATFORM_FEE_PERCENT,
} from '@/lib/deals/fees'

export function useCreateDealForm(supplierProducts: SupplierProductRow[]) {
  const [formData, setFormData] = useState<CreateDealFormData>(DEFAULT_FORM_DATA)
  const [currentStep, setCurrentStep] = useState<FormStep>(1)

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

  const parsedQuantity = Number(formData.quantity)
  const isQuantityValid = Number.isFinite(parsedQuantity) && parsedQuantity > 0

  const totalAmount =
    selectedProduct && isQuantityValid
      ? parsedQuantity * Number(selectedProduct.price_per_unit)
      : 0

  const fundingTotal = investorFundingTotal(totalAmount)
  const feeAmount = platformFeeAmount(totalAmount)

  const parsedTerm = Number(formData.term)
  const isTermValid = Number.isInteger(parsedTerm) && parsedTerm > 0
  const termDays = isTermValid ? parsedTerm : 60

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

  const fundingWindowDays = Number(formData.fundingWindowDays)
  const isFundingWindowValid =
    Number.isInteger(fundingWindowDays) && fundingWindowDays > 0

  const canProceedStep1 =
    Boolean(formData.category || availableCategories.length === 0) &&
    Boolean(formData.supplierId && formData.productId) &&
    isQuantityValid

  const canProceedStep2 =
    Boolean(formData.supplierName) && isTermValid && isFundingWindowValid

  const canSubmit = canProceedStep1 && canProceedStep2

  const supplierLogoUrl = filteredSuppliers.find((s) => s.id === formData.supplierId)?.logo_url ?? selectedProduct?.supplier?.logo_url

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

  return {
    formData,
    setFormData,
    availableCategories,
    filteredSuppliers,
    productsForSupplier,
    selectedProduct,
    totalAmount,
    fundingTotal,
    feeAmount,
    platformFeePercent: PLATFORM_FEE_PERCENT,
    termDays,
    yieldBonusApr,
    baseAPR,
    effectiveAPR,
    estimatedYield,
    fundingWindowDays,
    isFundingWindowValid,
    canProceedStep1,
    canProceedStep2,
    canSubmit,
    supplierLogoUrl,
    currentStep,
    maxYieldBonusApr: MAX_YIELD_BONUS_APR,
    updateFormData,
    handleSupplierSelect,
    goBack: () => setCurrentStep((prev) => Math.max(1, prev - 1) as FormStep),
    goNext: () => setCurrentStep((prev) => Math.min(2, prev + 1) as FormStep),
  }
}
