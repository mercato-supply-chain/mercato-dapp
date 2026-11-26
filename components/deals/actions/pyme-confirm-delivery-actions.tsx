'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'

type Supabase = ReturnType<typeof createClient>

export interface PymeConfirmDeliveryActionsProps {
  deal: Deal
  supabase: Supabase
  onRefresh: () => Promise<void>
}

export function PymeConfirmDeliveryActions({
  deal,
  supabase,
  onRefresh,
}: PymeConfirmDeliveryActionsProps) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const lockRef = useRef(false)

  if (!deal.shippedAt || deal.deliveredAt || deal.repaymentStatus !== 'none') {
    return null
  }

  const handleConfirmDelivery = async () => {
    if (lockRef.current) return
    lockRef.current = true
    setBusy(true)
    try {
      const deliveredAt = new Date()
      const repaymentDueAt = new Date(deliveredAt)
      repaymentDueAt.setDate(repaymentDueAt.getDate() + Math.max(1, deal.term))

      const { data: updatedRow, error } = await supabase
        .from('deals')
        .update({
          delivered_at: deliveredAt.toISOString(),
          repayment_status: 'order_confirmed',
          repayment_due_at: repaymentDueAt.toISOString(),
          status: 'in_progress',
        })
        .eq('id', deal.id)
        .eq('repayment_status', 'none')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!updatedRow) {
        await onRefresh()
        throw new Error(t('dealDetail.deliveryReceivedFail'))
      }
      await onRefresh()
      toast.success(t('dealDetail.deliveryReceivedSuccess'))
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('dealDetail.deliveryReceivedFail'),
      )
    } finally {
      lockRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleConfirmDelivery}
        disabled={busy}
        className="w-full"
      >
        {busy
          ? t('dealDetail.deliveryConfirming')
          : t('dealDetail.deliveryConfirmReceivedCta')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t('dealDetail.deliveryConfirmReceivedHint', { days: deal.term })}
      </p>
    </div>
  )
}
