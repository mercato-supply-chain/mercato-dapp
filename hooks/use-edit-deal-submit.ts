'use client'

import { useState } from 'react'

interface EditDealParams {
  dealId: string
  userId: string | null
  isAdmin: boolean
  productId: string
  supplierId: string
  description: string
  productQuantity: number
  termDays: number
  yieldBonusApr: number
  supplierName: string
  supplierContact: string | null
  fundingWindowDays: number
  previousFundingWindowDays?: number | null
}

export function useEditDealSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (
    params: EditDealParams,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (!params.userId) return { ok: false, error: 'User not authenticated' }
      if (!params.productId) throw new Error('Product is required')

      const response = await fetch('/api/deals/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: params.dealId,
          productId: params.productId,
          supplierId: params.supplierId,
          quantity: params.productQuantity,
          termDays: params.termDays,
          fundingWindowDays: params.fundingWindowDays,
          description: params.description,
          supplierName: params.supplierName,
          supplierContact: params.supplierContact,
          yieldBonusApr: params.yieldBonusApr,
          previousFundingWindowDays: params.previousFundingWindowDays,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update deal')
      }

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
