'use client'

import { useState } from 'react'

interface ReopenDealParams {
  dealId: string
  fundingWindowDays: number
}

export function useAdminReopenDeal() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (
    params: ReopenDealParams,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/deals/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reopen',
          dealId: params.dealId,
          fundingWindowDays: params.fundingWindowDays,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; id?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to reopen deal')
      }

      if (!payload?.id) {
        throw new Error('Failed to reopen deal')
      }

      return { ok: true, id: payload.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.error('Error reopening deal:', err)
      setError(message)
      return { ok: false, error: message }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting, error }
}
