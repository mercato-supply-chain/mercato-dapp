import { LayoutDashboard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { AdminOverviewSummaryGrid } from '@/components/dashboard/admin/admin-overview-summary'
import { AdminTaskInbox } from '@/components/dashboard/admin/admin-task-inbox'
import { AdminTaskInboxDisputes } from '@/components/dashboard/admin/admin-task-inbox-disputes'
import { AdminVaultHealthCard } from '@/components/dashboard/admin/admin-vault-health-card'
import { getExpiredFundingDeals } from '@/lib/admin/get-expired-funding-deals'
import { getAdminOverview } from '@/lib/admin/get-admin-overview'
import { requireAdminProfile } from '@/lib/admin/require-admin'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'
import { getServerDictionary, getServerLocale, tr } from '@/lib/i18n/server'

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdminProfile()
  const [overview, expiredDeals, m, locale] = await Promise.all([
    getAdminOverview(supabase),
    getExpiredFundingDeals(supabase),
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

      {expiredDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {tr(m, 'adminOverview.expiredFundingTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {expiredDeals.map((deal) => (
              <div key={deal.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{deal.title || deal.supplier_name || '—'}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(Number(deal.amount ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tr(m, 'dealDetail.fundingDeadlineLabel')}{' '}
                    {deal.funding_expires_at
                      ? formatDate(deal.funding_expires_at)
                      : '—'}
                  </p>
                  {Number(deal.reopen_count ?? 0) > 0 && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {tr(m, 'adminOverview.reopenedCount', {
                        count: String(deal.reopen_count ?? 0),
                      })}
                    </Badge>
                  )}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/admin/deals/${deal.id}/reopen`}>
                    {tr(m, 'adminOverview.dealReopen')}
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
