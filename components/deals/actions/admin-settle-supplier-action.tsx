'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Deal } from '@/lib/types'

export interface AdminSettleSupplierActionProps {
  deal: Deal
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
}

export function AdminSettleSupplierAction({
  deal,
  fetchDeal,
  onDealUpdate,
}: AdminSettleSupplierActionProps) {
  const [isSettling, setIsSettling] = useState(false)
  const settlingLockRef = useRef(false)

  if (deal.rwaLifecycle !== 'ready_to_settle') return null

  const settleSupplier = async () => {
    if (!deal.rwaAssetId || settlingLockRef.current) return
    settlingLockRef.current = true
    setIsSettling(true)
    try {
      const response = await fetch('/api/rwa/settlements/supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: deal.rwaAssetId }),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body.message ?? 'Supplier settlement is not ready')
      }
      const updated = await fetchDeal()
      if (updated) onDealUpdate(updated)
      toast.success('Supplier settlement recorded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Supplier settlement failed')
    } finally {
      settlingLockRef.current = false
      setIsSettling(false)
    }
  }

  return (
    <Button type="button" onClick={() => void settleSupplier()} disabled={isSettling}>
      {isSettling ? 'Settling supplier…' : 'Settle supplier'}
    </Button>
  )
}
