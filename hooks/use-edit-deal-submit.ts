'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLATFORM_FEE_PERCENT } from '@/lib/deals/fees'

interface EditDealParams {
  dealId: string
  userId: string | null
  isAdmin: boolean
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
  /** Previous window days — expiry is only reset when the window changes. */
  previousFundingWindowDays?: number | null
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export function useEditDealSubmit() {
  const supabase = useMemo(() => createClient(), [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (
    params: EditDealParams,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (!params.userId) return { ok: false, error: 'User not authenticated' }

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

      const nowIso = new Date().toISOString()
      const windowChanged =
        params.previousFundingWindowDays == null ||
        params.previousFundingWindowDays !== params.fundingWindowDays

      const updatePayload: Record<string, unknown> = {
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
        supplier_id: params.supplierId,
        supplier_name: params.supplierName,
        supplier_email: ownerProfile?.email ?? null,
        supplier_contact: params.supplierContact,
        platform_fee: PLATFORM_FEE_PERCENT,
        funding_window_days: params.fundingWindowDays,
        updated_at: nowIso,
      }

      if (windowChanged) {
        updatePayload.funding_expires_at = new Date(
          Date.now() + params.fundingWindowDays * 24 * 60 * 60 * 1000,
        ).toISOString()
      }

      let query = supabase
        .from('deals')
        .update(updatePayload)
        .eq('id', params.dealId)
        .eq('status', 'seeking_funding')
        .is('investor_id', null)
        .is('funded_at', null)

      if (!params.isAdmin) {
        query = query.eq('pyme_id', params.userId)
      }

      const { data, error: dealError } = await query.select('id').single()

      if (dealError) throw dealError
      if (!data) throw new Error('Deal is no longer editable (it may have been funded)')

      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.error('Error updating deal:', err)
      setError(message)
      return { ok: false, error: message }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting, error }
}
