'use client'

import { useEffect, useRef, useState } from 'react'
import type { CreateDealFormData, SupplierProductRow, FormStep } from '@/app/create-deal/types'
import { DEFAULT_FORM_DATA } from '@/app/create-deal/types'
import { calculateYieldAPR, calculateYieldAmount } from '@/lib/yield'
import {
  investorFundingTotal,
  platformFeeAmount,
  PLATFORM_FEE_PERCENT,
} from '@/lib/deals/fees'
import { PRODUCT_CATEGORIES } from '@/lib/categories'

export function useCreateDealForm(
  supplierProducts: SupplierProductRow[],
  initialFormData?: CreateDealFormData | null,
) {
  const [formData, setFormData] = useState<CreateDealFormData>(DEFAULT_FORM_DATA)
  const [currentStep, setCurrentStep] = useState<FormStep>(1)
  const hydratedInitial = useRef(false)
  const [fetchedProducts, setFetchedProducts] = useState<SupplierProductRow[]>(supplierProducts)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!initialFormData || hydratedInitial.current) return
    setFormData(initialFormData)
    hydratedInitial.current = true
  }, [initialFormData])

  useEffect(() => {
    const controller = new AbortController()

    // Debounce: wait 300 ms before firing the request
    const timer = setTimeout(async () => {
      let url = `/api/catalog?pageSize=100`
      if (formData.category) url += `&category=${encodeURIComponent(formData.category)}`
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (res.ok) {
          const json = await res.json()
          setFetchedProducts(json.data || [])
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[useCreateDealForm] fetchCatalog', err)
        }
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [formData.category, searchQuery])

  // Combine initial supplierProducts with fetchedProducts to ensure selected items are always available
  const combinedProducts = [
    ...supplierProducts,
    ...fetchedProducts.filter(p => !supplierProducts.some(sp => sp.id === p.id))
  ]

  const availableCategories = PRODUCT_CATEGORIES.map(c => c.value).sort()

  const supplierIdsInCategory = formData.category
    ? [...new Set(combinedProducts.filter((p) => p.category === formData.category).map((p) => p.supplier_id))]
    : [...new Set(combinedProducts.map((p) => p.supplier_id))]

  const filteredSuppliers = supplierIdsInCategory
    .map((sid) => {
      const product = combinedProducts.find((p) => p.supplier_id === sid)
      const sup = product?.supplier
      return sup ? { id: sid, company_name: sup.company_name ?? '', logo_url: sup.logo_url } : null
    })
    .filter(Boolean) as { id: string; company_name: string; logo_url?: string | null }[]

  const productsForSupplier = formData.supplierId
    ? combinedProducts.filter(
        (p) => p.supplier_id === formData.supplierId && (!formData.category || p.category === formData.category)
      )
    : []

  const selectedProduct = formData.productId
    ? combinedProducts.find((p) => p.id === formData.productId)
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

  const yieldAPR =
    totalAmount > 0 ? calculateYieldAPR(termDays, totalAmount) : 0
  const estimatedEarnings =
    totalAmount > 0
      ? calculateYieldAmount(totalAmount, termDays, yieldAPR)
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
    const product = combinedProducts.find((p) => p.supplier_id === supplierId)
    const sup = product?.supplier
    if (sup) {
      setFormData((prev) => ({
        ...prev,
        supplierId,
        supplierName: sup.company_name ?? '',
        supplierContact: '',
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
    yieldAPR,
    estimatedEarnings,
    fundingWindowDays,
    isFundingWindowValid,
    canProceedStep1,
    canProceedStep2,
    canSubmit,
    supplierLogoUrl,
    currentStep,
    searchQuery,
    setSearchQuery,
    updateFormData,
    handleSupplierSelect,
    goBack: () => setCurrentStep((prev) => Math.max(1, prev - 1) as FormStep),
    goNext: () => setCurrentStep((prev) => Math.min(2, prev + 1) as FormStep),
  }
}
