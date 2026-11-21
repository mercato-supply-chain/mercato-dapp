'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'

type Supabase = ReturnType<typeof createClient>

export interface SupplierShipActionsProps {
  deal: Deal
  supabase: Supabase
  onRefresh: () => Promise<void>
}

export function SupplierShipActions({
  deal,
  supabase,
  onRefresh,
}: SupplierShipActionsProps) {
  const { t } = useI18n()
  const [trackingId, setTrackingId] = useState(deal.trackingId ?? '')
  const [busy, setBusy] = useState(false)
  const lockRef = useRef(false)

  if (deal.shippedAt || deal.status === 'completed' || deal.status === 'awaiting_funding') {
    return null
  }

  const handleConfirmShipment = async () => {
    if (lockRef.current) return
    const trimmed = trackingId.trim()
    if (!trimmed) {
      toast.error(t('dealDetail.deliveryTrackingRequired'))
      return
    }
    lockRef.current = true
    setBusy(true)
    try {
      const { data: updatedRow, error } = await supabase
        .from('deals')
        .update({
          tracking_id: trimmed,
          shipped_at: new Date().toISOString(),
          status: 'in_progress',
        })
        .eq('id', deal.id)
        .neq('status', 'completed')
        .neq('status', 'seeking_funding')
        .is('shipped_at', null)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!updatedRow) {
        await onRefresh()
        throw new Error(t('dealDetail.deliveryShippedFail'))
      }
      await onRefresh()
      toast.success(t('dealDetail.deliveryShippedSuccess'))
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('dealDetail.deliveryShippedFail'),
      )
    } finally {
      lockRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="shipment-tracking-id">
          {t('dealDetail.deliveryTrackingLabel')}
        </Label>
        <Input
          id="shipment-tracking-id"
          value={trackingId}
          onChange={(e) => setTrackingId(e.target.value)}
          placeholder={t('dealDetail.deliveryTrackingPlaceholder')}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          {t('dealDetail.deliveryTrackingHint')}
        </p>
      </div>
      <Button
        type="button"
        onClick={handleConfirmShipment}
        disabled={busy}
        className="w-full"
      >
        {busy
          ? t('dealDetail.deliveryShipping')
          : t('dealDetail.deliveryConfirmShipCta')}
      </Button>
    </div>
  )
}
