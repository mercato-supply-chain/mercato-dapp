import { LayoutDashboard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AdminOverviewSummaryGrid } from '@/components/dashboard/admin/admin-overview-summary'
import { AdminTaskInbox } from '@/components/dashboard/admin/admin-task-inbox'
import { AdminTaskInboxDisputes } from '@/components/dashboard/admin/admin-task-inbox-disputes'
import { AdminVaultHealthCard } from '@/components/dashboard/admin/admin-vault-health-card'
import { getAdminOverview } from '@/lib/admin/get-admin-overview'
import { requireAdminProfile } from '@/lib/admin/require-admin'
import { getServerDictionary, getServerLocale, tr } from '@/lib/i18n/server'

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdminProfile()
  const [overview, m, locale] = await Promise.all([
    getAdminOverview(supabase),
    getServerDictionary(),
    getServerLocale(),
  ])

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">
            {tr(m, 'adminOverview.title')}
          </h1>
          <Badge variant="secondary" className="text-xs">
            Admin
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{tr(m, 'adminOverview.subtitle')}</p>
      </header>

      <AdminOverviewSummaryGrid summary={overview.summary} messages={m} locale={locale} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AdminTaskInbox tasks={overview.tasks} messages={m} locale={locale}>
          <AdminTaskInboxDisputes escrows={overview.escrows} />
        </AdminTaskInbox>
        <AdminVaultHealthCard vaultConfigured={overview.vaultConfigured} />
      </div>
    </div>
  )
}
