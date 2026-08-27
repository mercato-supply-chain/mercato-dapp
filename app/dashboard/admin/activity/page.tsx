import { Suspense } from 'react'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AdminActivityTable } from '@/components/dashboard/admin/admin-activity-table'
import { getAdminAuditEvents } from '@/lib/admin/admin-audit'
import { requireAdminProfile } from '@/lib/admin/require-admin'
import { getServerDictionary, tr } from '@/lib/i18n/server'

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>

async function resolveSearchParams(searchParams?: SearchParams) {
  if (!searchParams) return {}
  if (typeof (searchParams as Promise<unknown>).then === 'function') {
    return (await searchParams) as Record<string, string | string[] | undefined>
  }
  return searchParams as Record<string, string | string[] | undefined>
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function utcDayParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const { supabase } = await requireAdminProfile()
  const m = await getServerDictionary()
  const params = await resolveSearchParams(searchParams)

  const rawPage = Number.parseInt(firstParam(params.page) ?? '', 10)
  const from = utcDayParam(firstParam(params.from))
  const to = utcDayParam(firstParam(params.to))

  const result = await getAdminAuditEvents(supabase, {
    adminId: firstParam(params.admin),
    action: firstParam(params.action),
    entityType: firstParam(params.entity),
    from: from ? `${from}T00:00:00.000Z` : null,
    to: to ? `${to}T23:59:59.999Z` : null,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  })

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <History className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">
            {tr(m, 'adminActivity.title')}
          </h1>
          <Badge variant="secondary" className="text-xs tabular-nums">
            {result.total}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{tr(m, 'adminActivity.subtitle')}</p>
      </header>

      <Suspense fallback={null}>
        <AdminActivityTable
          rows={result.rows}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          admins={result.admins}
        />
      </Suspense>
    </div>
  )
}
