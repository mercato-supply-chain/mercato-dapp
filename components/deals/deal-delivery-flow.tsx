'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Package, Truck, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Deal } from '@/lib/types'
import type { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'

type Supabase = ReturnType<typeof createClient>

interface DealDeliveryFlowProps {
  deal: Deal
  isSupplier: boolean
  isPyme: boolean
  isAdmin: boolean
  supabase: Supabase
  fetchDeal: () => Promise<Deal | null>
  onDealUpdate: (deal: Deal) => void
}

export function DealDeliveryFlow({
  deal,
  isSupplier,
  isPyme,
  isAdmin,
  supabase,
  fetchDeal,
  onDealUpdate,
}: DealDeliveryFlowProps) {
  const { t } = useI18n()
  const [trackingId, setTrackingId] = useState(deal.trackingId ?? '')
  const [busy, setBusy] = useState(false)

  if (deal.status === 'awaiting_funding') return null

  const isShipped = Boolean(deal.shippedAt)
  const isDelivered = Boolean(deal.deliveredAt)
  const canShip =
    (isSupplier || isAdmin) && !isShipped && deal.status !== 'completed'
  const canConfirmDelivery =
    (isPyme || isAdmin) && isShipped && !isDelivered && deal.repaymentStatus === 'none'

  const refresh = async () => {
    const updated = await fetchDeal()
    if (updated) onDealUpdate(updated)
  }

  const handleConfirmShipment = async () => {
    if (!isSupplier && !isAdmin) {
      toast.error(t('dealDetail.deliveryShipOnlySupplierOrAdmin'))
      return
    }
    const trimmed = trackingId.trim()
    if (!trimmed) {
      toast.error(t('dealDetail.deliveryTrackingRequired'))
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase
        .from('deals')
        .update({
          tracking_id: trimmed,
          shipped_at: new Date().toISOString(),
          status: 'in_progress',
        })
        .eq('id', deal.id)
      if (error) throw error
      await refresh()
      toast.success(t('dealDetail.deliveryShippedSuccess'))
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('dealDetail.deliveryShippedFail'),
      )
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmDelivery = async () => {
    setBusy(true)
    try {
      const deliveredAt = new Date()
      const repaymentDueAt = new Date(deliveredAt)
      repaymentDueAt.setDate(repaymentDueAt.getDate() + Math.max(1, deal.term))

      const { error } = await supabase
        .from('deals')
        .update({
          delivered_at: deliveredAt.toISOString(),
          repayment_status: 'order_confirmed',
          repayment_due_at: repaymentDueAt.toISOString(),
          status: 'in_progress',
        })
        .eq('id', deal.id)
      if (error) throw error
      await refresh()
      toast.success(t('dealDetail.deliveryReceivedSuccess'))
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('dealDetail.deliveryReceivedFail'),
      )
    } finally {
      setBusy(false)
    }
  }

  let statusLabel = t('dealDetail.deliveryStatusAwaitingShipment')
  let statusVariant: 'outline' | 'secondary' | 'default' = 'outline'
  if (isDelivered) {
    statusLabel = t('dealDetail.deliveryStatusDelivered')
    statusVariant = 'default'
  } else if (isShipped) {
    statusLabel = t('dealDetail.deliveryStatusInTransit')
    statusVariant = 'secondary'
  }

  return (
    <Card id="delivery-panel">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('dealDetail.deliveryTitle')}</CardTitle>
            <CardDescription className="mt-1">
              {t('dealDetail.deliveryDescription')}
            </CardDescription>
          </div>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                isShipped ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Truck className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t('dealDetail.deliveryStepShip')}</p>
              <p className="text-muted-foreground">{t('dealDetail.deliveryStepShipHint')}</p>
              {isShipped ? (
                <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {t('dealDetail.deliveryShippedOn', {
                      date: formatDate(deal.shippedAt!),
                    })}
                  </p>
                  {deal.trackingId ? (
                    <p className="font-mono text-sm">
                      <span className="text-muted-foreground">
                        {t('dealDetail.deliveryTrackingLabel')}:{' '}
                      </span>
                      {deal.trackingId}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>

          <li className="flex gap-3">
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                isDelivered
                  ? 'bg-success/15 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Package className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t('dealDetail.deliveryStepReceive')}</p>
              <p className="text-muted-foreground">
                {t('dealDetail.deliveryStepReceiveHint')}
              </p>
              {isDelivered && deal.deliveredAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('dealDetail.deliveryReceivedOn', {
                    date: formatDate(deal.deliveredAt),
                  })}
                </p>
              ) : null}
            </div>
          </li>

          <li className="flex gap-3">
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                deal.repaymentStatus !== 'none' && deal.repaymentStatus !== 'order_confirmed'
                  ? 'bg-success/15 text-success'
                  : deal.repaymentStatus === 'order_confirmed'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t('dealDetail.deliveryStepRepayment')}</p>
              <p className="text-muted-foreground">
                {t('dealDetail.deliveryStepRepaymentHint')}
              </p>
            </div>
          </li>
        </ol>

        {canShip ? (
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
        ) : null}

        {canConfirmDelivery ? (
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
        ) : null}

        {!isShipped && !isSupplier && !isAdmin ? (
          <p className="text-sm text-muted-foreground">
            {t('dealDetail.deliveryAwaitingSupplier')}
          </p>
        ) : null}

        {isShipped && !isDelivered && !isPyme && !isAdmin ? (
          <p className="text-sm text-muted-foreground">
            {t('dealDetail.deliveryAwaitingBuyer')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
