'use client'

import type { ReactNode } from 'react'
import { Package, Truck, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Deal } from '@/lib/types'
import { formatDate } from '@/lib/date-utils'
import { useI18n } from '@/lib/i18n/provider'

export interface DealDeliveryFlowProps {
  deal: Deal
  /** Role-specific delivery action slot (e.g. SupplierShipActions or PymeConfirmDeliveryActions). */
  actions?: ReactNode
  /** Optional read-only status hint for viewers who cannot act on the current step. */
  statusNotice?: ReactNode
}

export function DealDeliveryFlow({
  deal,
  actions,
  statusNotice,
}: DealDeliveryFlowProps) {
  const { t } = useI18n()

  if (deal.status === 'awaiting_funding') return null

  const isShipped = Boolean(deal.shippedAt)
  const isDelivered = Boolean(deal.deliveredAt)

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

        {actions}
        {statusNotice}
      </CardContent>
    </Card>
  )
}
