import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AdminApprovalsEmpty, AdminQueueFilters } from '@/components/dashboard/admin/admin-queue-filters'
import { getAdminQueueData } from '@/lib/admin/get-admin-queue-data'
import { requireAdminProfile } from '@/lib/admin/require-admin'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { AdminEscrowsProvider } from '../admin-escrows-provider'

type SearchParams = Promise<{ company?: string; sort?: string }> | { company?: string; sort?: string }

async function resolveSearchParams(searchParams?: SearchParams) {
  if (!searchParams) return {}
  if (typeof (searchParams as Promise<unknown>).then === 'function') {
    return (await searchParams) as { company?: string; sort?: string }
  }
  return searchParams as { company?: string; sort?: string }
}

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const { supabase } = await requireAdminProfile()
  const m = await getServerDictionary()
  const params = await resolveSearchParams(searchParams)
  const sortOrder = (params.sort ?? 'newest') as 'newest' | 'oldest'

  const queue = await getAdminQueueData(supabase, {
    company: params.company ?? null,
    sort: sortOrder,
  })

  const hasFilters = queue.uniquePymes.length > 0 || queue.uniqueSuppliers.length > 0
  const basePath = '/dashboard/admin/approvals'

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">{tr(m, 'adminPage.title')}</h1>
          <Badge variant="secondary" className="text-xs">
            Admin
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{tr(m, 'adminPage.subtitle')}</p>
      </header>

      <AdminQueueFilters
        basePath={basePath}
        companyFilter={queue.companyFilter}
        sortOrder={queue.sortOrder}
        uniquePymes={queue.uniquePymes}
        uniqueSuppliers={queue.uniqueSuppliers}
        hasFilters={hasFilters}
      />

      {queue.emptyState ? (
        <AdminApprovalsEmpty emptyState />
      ) : (
        <AdminEscrowsProvider
          items={queue.items}
          createEscrowItems={queue.createEscrowItems}
          releaseFallbackItems={queue.releaseFallbackItems}
        />
      )}
    </div>
  )
}
