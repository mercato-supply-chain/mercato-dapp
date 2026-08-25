import { Suspense } from 'react'
import { UserCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AdminUsersFilters } from '@/components/dashboard/admin/admin-users-filters'
import { AdminUsersTable } from '@/components/dashboard/admin/admin-users-table'
import {
  getAdminUsers,
  parseAdminUsersSearchParams,
} from '@/lib/admin/get-admin-users'
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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const { supabase } = await requireAdminProfile()
  const m = await getServerDictionary()
  const params = await resolveSearchParams(searchParams)
  const filters = parseAdminUsersSearchParams(params)
  const result = await getAdminUsers(supabase, filters)

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">
            {tr(m, 'adminUsers.title')}
          </h1>
          <Badge variant="secondary" className="text-xs tabular-nums">
            {result.total}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{tr(m, 'adminUsers.subtitle')}</p>
      </header>

      <Suspense fallback={null}>
        <AdminUsersFilters />
        <AdminUsersTable
          rows={result.rows}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
        />
      </Suspense>
    </div>
  )
}
