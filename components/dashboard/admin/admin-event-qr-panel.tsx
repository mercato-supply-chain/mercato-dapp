'use client'

import { useI18n } from '@/lib/i18n/provider'
import type { EventConfig } from '@/lib/events/config'
import { AdminEventQrCard } from '@/components/dashboard/admin/admin-event-qr-card'

type AdminEventQrPanelProps = {
  events: EventConfig[]
}

export function AdminEventQrPanel({ events }: AdminEventQrPanelProps) {
  const { t } = useI18n()

  if (events.length === 0) return null

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t('adminLeads.qr.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('adminLeads.qr.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <AdminEventQrCard key={event.slug} event={event} />
        ))}
      </div>
    </section>
  )
}
