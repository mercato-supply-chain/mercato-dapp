import { Suspense } from 'react'
import { Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AdminLeadsTable } from '@/components/dashboard/admin/admin-leads-table'
import { AdminEventQrPanel } from '@/components/dashboard/admin/admin-event-qr-panel'
import { getLeadEventSlugs, getLeads } from '@/lib/admin/get-leads'
import { requireAdminProfile } from '@/lib/admin/require-admin'
import { EVENTS } from '@/lib/events/config'
import { getServerDictionary, tr } from '@/lib/i18n/server'

type SearchParams = Promise<{ event?: string }> | { event?: string }

async function resolveSearchParams(searchParams?: SearchParams) {
  if (!searchParams) return {}
  if (typeof (searchParams as Promise<unknown>).then === 'function') {
    return (await searchParams) as { event?: string }
  }
  return searchParams as { event?: string }
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const { supabase } = await requireAdminProfile()
  const m = await getServerDictionary()
  const params = await resolveSearchParams(searchParams)
  const selectedEvent = params.event?.trim() || null

  const [leads, eventSlugs] = await Promise.all([
    getLeads(supabase, selectedEvent),
    getLeadEventSlugs(supabase),
  ])

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Users className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">{tr(m, 'adminLeads.title')}</h1>
          <Badge variant="secondary" className="text-xs">
            {leads.length}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{tr(m, 'adminLeads.subtitle')}</p>
      </header>

      <AdminEventQrPanel events={EVENTS.filter((event) => event.active)} />

      <Suspense fallback={null}>
        <AdminLeadsTable leads={leads} eventSlugs={eventSlugs} selectedEvent={selectedEvent} />
      </Suspense>
    </div>
  )
}
