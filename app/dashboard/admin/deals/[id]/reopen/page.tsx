import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminReopenDealClient } from '@/components/deals/admin-reopen-deal-client'
import { isDealFundingExpired, mapDealFromDb, type DealRow } from '@/lib/deals'
import { requireAdminProfile } from '@/lib/admin/require-admin'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/date-utils'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminReopenDealPage({ params }: PageProps) {
  const { id } = await params
  const { supabase } = await requireAdminProfile()
  const [m] = await Promise.all([getServerDictionary()])

  const { data, error } = await supabase
    .from('deals')
    .select(
      `
      *,
      milestones(*),
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name, stake_amount, address),
      supplier:supplier_companies(company_name, full_name, contact_name, owner_id, address)
    `,
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    redirect('/dashboard/admin')
  }

  const row = data as DealRow
  const deal = mapDealFromDb(row)

  if (
    deal.status !== 'awaiting_funding' ||
    deal.investorId ||
    !isDealFundingExpired(row)
  ) {
    redirect(`/deals/${id}`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{tr(m, 'dealDetail.adminReopenTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr(m, 'dealDetail.adminReopenDescription')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{deal.productName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">{tr(m, 'common.supplier')}:</span>{' '}
            {deal.supplier}
          </p>
          <p>
            <span className="text-muted-foreground">{tr(m, 'common.amount')}:</span>{' '}
            {formatCurrency(deal.priceUSDC)}
          </p>
          {deal.fundingExpiresAt ? (
            <p>
              <span className="text-muted-foreground">{tr(m, 'dealDetail.fundingDeadlineLabel')}:</span>{' '}
              {formatDate(deal.fundingExpiresAt)}
            </p>
          ) : null}
          {(deal.reopenCount ?? 0) > 0 ? (
            <p className="text-muted-foreground">
              {tr(m, 'adminOverview.reopenedCount', { count: String(deal.reopenCount ?? 0) })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AdminReopenDealClient deal={deal} />

      <Button asChild variant="outline">
        <Link href={`/deals/${id}`}>{tr(m, 'common.back')}</Link>
      </Button>
    </div>
  )
}
