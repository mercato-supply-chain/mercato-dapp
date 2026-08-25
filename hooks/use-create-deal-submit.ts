'use client'

import { useState } from 'react'

interface CreateDealParams {
  userId: string | null
  signerAddress: string
  productId: string
  supplierId: string
  description: string
  productQuantity: number
  termDays: number
  yieldBonusApr: number
  supplierName: string
  supplierContact: string | null
  fundingWindowDays: number
}

export function useCreateDealSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (
    params: CreateDealParams,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (!params.userId) return { ok: false, error: 'User not authenticated' }
      if (!params.signerAddress) throw new Error('Wallet not connected')
      if (!params.productId) throw new Error('Product is required')

      const response = await fetch('/api/deals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: params.productId,
          supplierId: params.supplierId,
          quantity: params.productQuantity,
          termDays: params.termDays,
          fundingWindowDays: params.fundingWindowDays,
          description: params.description,
          supplierName: params.supplierName,
          supplierContact: params.supplierContact,
          yieldBonusApr: params.yieldBonusApr,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create deal')
      }

      fetch('/api/referral/milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone: 'deal_created' }),
      }).catch(() => {})

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
