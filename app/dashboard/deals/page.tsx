import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardDealsView } from '@/components/dashboard/dashboard-deals-view'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { dealStatusLabel, getServerDictionary } from '@/lib/i18n/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Package,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Upload,
  ShieldCheck,
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

type MilestoneRow = {
  id: string
  title: string
  status: string
  percentage: number
  amount?: number
}

type DealRow = {
  id: string
  title: string
  product_name: string
  status: string
  amount: number
  created_at: string | null
  funded_at: string | null
  escrow_contract_address: string | null
  tracking_id: string | null
  shipped_at: string | null
  delivered_at: string | null
  pyme_id: string
  milestones: MilestoneRow[]
  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
  investor?: { company_name?: string; full_name?: string; contact_name?: string } | null
}

type DealsSearchParams = Promise<{ company?: string }> | { company?: string }

export default async function DashboardDealsPage({
  searchParams,
}: {
  searchParams?: DealsSearchParams
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  const params = searchParams
    ? typeof (searchParams as Promise<{ company?: string }>).then === 'function'
      ? await (searchParams as Promise<{ company?: string }>)
      : (searchParams as { company?: string })
    : {}
  const companyFilterId = params.company ?? null

  if (profile?.user_type !== 'supplier') {
    const t = await getServerDictionary()
    const { data: fullProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const data = await getDashboardData(supabase, user.id, fullProfile, user.email, companyFilterId)
    return <DashboardDealsView data={data} t={t} />
  }

  const { data: supplierCompanies } = await supabase
    .from('supplier_companies')
    .select('id, company_name')
    .eq('owner_id', user.id)
  const companies = supplierCompanies ?? []
  const companyIds = companies.map((c) => c.id)

  const filterByCompany =
    companyFilterId && companyIds.includes(companyFilterId) ? companyFilterId : null

  const query = companyIds.length > 0
    ? supabase
        .from('deals')
        .select(
          `
      id,
      title,
      product_name,
      status,
      amount,
      created_at,
      funded_at,
      escrow_contract_address,
      tracking_id,
      shipped_at,
      delivered_at,
      pyme_id,
      milestones(id, title, status, percentage, amount),
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name),
      investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name)
    `
        )
        .order('created_at', { ascending: false })
    : null

  const { data: deals } = query
    ? filterByCompany
      ? await query.eq('supplier_id', filterByCompany)
      : await query.in('supplier_id', companyIds)
    : { data: null }

  const list = (deals ?? []) as DealRow[]
  const m = await getServerDictionary()

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My deals</h1>
          <p className="text-muted-foreground">
            Deals where you are the supplier. Once funded, confirm shipment with a tracking ID so the buyer can verify delivery.
          </p>
          {companies.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by company:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  variant={!companyFilterId ? 'default' : 'outline'}
                  size="sm"
                >
                  <Link href="/dashboard/deals">All companies</Link>
                </Button>
                {companies.map((c) => (
                  <Button
                    key={c.id}
                    asChild
                    variant={companyFilterId === c.id ? 'default' : 'outline'}
                    size="sm"
                  >
                    <Link href={`/dashboard/deals?company=${c.id}`}>
                      {c.company_name || 'Unnamed company'}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {list.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" aria-hidden />
                No deals yet
              </CardTitle>
              <CardDescription>
                Deals where you are selected as the supplier will appear here. PyMEs create deals and choose suppliers when they browse the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  Back to dashboard
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Sorted by newest first
              {filterByCompany &&
                ` · ${companies.find((c) => c.id === filterByCompany)?.company_name || 'Selected company'}`}
            </p>
            {/* Short security note */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
                <div>
                  <p className="font-medium">Supplier paid at funding</p>
                  <p className="text-sm text-muted-foreground">
                    Confirm shipment with a tracking ID after funding. The buyer confirms receipt to start repayment.
                  </p>
                </div>
              </CardContent>
            </Card>

            {list.map((deal) => {
              const title = deal.product_name || deal.title
              const statusLabel = dealStatusLabel(m, deal.status)
              const amount = Number(deal.amount)
              const pymeName =
                deal.pyme?.company_name || deal.pyme?.full_name || deal.pyme?.contact_name || 'PyME'
              const investorName =
                deal.investor?.company_name ||
                deal.investor?.full_name ||
                deal.investor?.contact_name ||
                null
              const isFunded = deal.status === 'funded' || deal.status === 'in_progress'
              const hasEscrow = Boolean(deal.escrow_contract_address)
              const needsShipment = isFunded && !deal.shipped_at
              const shipmentDone = Boolean(deal.shipped_at)
              const deliveryDone = Boolean(deal.delivered_at)

              return (
                <Card key={deal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{title}</CardTitle>
                        <CardDescription className="mt-1">
                          Created {deal.created_at ? formatDate(deal.created_at) : '—'}
                          {deal.funded_at && ` · Funded ${formatDate(deal.funded_at)}`}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          deal.status === 'funded' || deal.status === 'in_progress'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                        Deal overview
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Total amount</p>
                          <p className="font-semibold tabular-nums">
                            ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
                            USDC
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground">PyME (buyer)</p>
                          <p className="font-medium">{pymeName}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Investor</p>
                          <p className="font-medium">{investorName ?? 'Awaiting funding'}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Repayment escrow</p>
                          <p className="flex items-center gap-1.5 text-sm">
                            {hasEscrow ? (
                              <>
                                <Lock className="h-4 w-4 text-success" aria-hidden />
                                On-chain
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {deliveryDone ? 'Pending admin' : isFunded ? 'After delivery' : 'After funding'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isFunded ? (
                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                          Delivery
                        </h3>
                        <div className="space-y-2">
                          <div
                            className={`flex items-center justify-between gap-4 rounded-lg border p-3 ${
                              shipmentDone ? 'border-success bg-success/5' : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {shipmentDone ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                              ) : (
                                <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                              )}
                              <div>
                                <p className="font-medium">Confirm shipment</p>
                                <p className="text-xs text-muted-foreground">
                                  {shipmentDone
                                    ? deal.tracking_id
                                      ? `Tracking: ${deal.tracking_id}`
                                      : 'Shipped'
                                    : 'Add a tracking ID after sending the goods'}
                                </p>
                              </div>
                            </div>
                            {needsShipment ? (
                              <Button asChild size="sm">
                                <Link href={`/deals/${deal.id}?action=ship`}>
                                  <Upload className="mr-2 h-4 w-4" aria-hidden />
                                  Confirm shipment
                                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                          <div
                            className={`flex items-center justify-between gap-4 rounded-lg border p-3 ${
                              deliveryDone ? 'border-success bg-success/5' : 'border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {deliveryDone ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                              ) : (
                                <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                              )}
                              <div>
                                <p className="font-medium">Buyer confirms receipt</p>
                                <p className="text-xs text-muted-foreground">
                                  {deliveryDone
                                    ? 'Delivery confirmed — repayment period started'
                                    : shipmentDone
                                      ? 'Waiting for the SMB to confirm arrival'
                                      : 'Available after you confirm shipment'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                      <span className="text-sm text-muted-foreground">
                        View full details, documents, and on-chain info
                      </span>
                      <Button asChild size="sm">
                        <Link href={`/deals/${deal.id}`}>
                          View deal
                          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
    </div>
  )
}
