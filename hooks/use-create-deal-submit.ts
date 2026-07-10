'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLATFORM_FEE_PERCENT } from '@/lib/deals/fees'

interface CreateDealParams {
  userId: string | null
  signerAddress: string
  supplierId: string
  productName: string
  description: string
  productQuantity: number
  productUnitPrice: number
  totalAmount: number
  termDays: number
  effectiveAPR: number
  yieldBonusApr: number
  category: string
  supplierName: string
  supplierContact: string | null
  fundingWindowDays: number
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export function useCreateDealSubmit() {
  const supabase = useMemo(() => createClient(), [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (
    params: CreateDealParams
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (!params.userId) return { ok: false, error: 'User not authenticated' }
      if (!params.signerAddress) throw new Error('Wallet not connected')

      if (!isPositiveFinite(params.productQuantity))
        throw new Error('Product quantity must be a positive finite number')
      if (!isPositiveFinite(params.productUnitPrice))
        throw new Error('Product unit price must be a positive finite number')
      if (!isPositiveFinite(params.totalAmount))
        throw new Error('Total amount must be a positive finite number')
      if (!isPositiveInteger(params.termDays))
        throw new Error('Term days must be a positive integer')
      if (!isPositiveInteger(params.fundingWindowDays))
        throw new Error('Funding window days must be a positive integer')

      const { data: company } = await supabase
        .from('supplier_companies')
        .select('id, address, owner_id')
        .eq('id', params.supplierId)
        .single()

      const supplierAddress = company?.address?.trim()
      if (!supplierAddress) {
        throw new Error('Supplier wallet address not found')
      }

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', company?.owner_id)
        .single()

      const fundingExpiresAt = new Date(
        Date.now() + params.fundingWindowDays * 24 * 60 * 60 * 1000
      ).toISOString()

      const { error: dealError } = await supabase.from('deals').insert({
        pyme_id: params.userId,
        title: params.productName,
        description: params.description,
        product_name: params.productName,
        product_quantity: params.productQuantity,
        product_unit_price: params.productUnitPrice,
        amount: params.totalAmount,
        term_days: params.termDays,
        interest_rate: params.effectiveAPR,
        yield_bonus_apr: params.yieldBonusApr,
        category: params.category,
        status: 'seeking_funding',
        supplier_id: params.supplierId,
        supplier_name: params.supplierName,
        supplier_email: ownerProfile?.email ?? null,
        supplier_contact: params.supplierContact,
        platform_fee: PLATFORM_FEE_PERCENT,
        funding_window_days: params.fundingWindowDays,
        funding_expires_at: fundingExpiresAt,
        extension_count: 0,
        repayment_status: 'none',
      })

      if (dealError) throw dealError

      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.error('Error creating deal:', err)
      setError(message)
      return { ok: false, error: message }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting, error }
}
