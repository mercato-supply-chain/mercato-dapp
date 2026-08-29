import { LayoutDashboard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
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

  // Fetch expired funding opportunities that are eligible for reopening
  const { data: expiredDeals, error: expiredDealsError } = await supabase
    .from('deals')
    .select('id, supplier_name, order_value, expires_at, reopen_count, last_reopened_at')
    .eq('status', 'expired')
    .order('expires_at', { ascending: false })
    .limit(5)

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

      {/* Expired funding opportunities management */}
      {!expiredDealsError && expiredDeals && expiredDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Expired Funding Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {expiredDeals.map((deal) => (
              <div key={deal.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{deal.supplier_name ?? 'Unknown supplier'}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).surformat(Number(deal.order_value ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expired: {deal.expires_at ? new Date(deal.expires_at).toLocaleDateString(locale) : 'N/A'}
                  </p>
                  {Number(deal.reopen_count ?? 0) > 0 && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      Reopened Opportunity (x {String(deal.reopen_count ?? 0)})
                    </Badge>
                  )}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/admin/deals/${deal.id}/reopen`}>
                    Reopen Opportunity
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