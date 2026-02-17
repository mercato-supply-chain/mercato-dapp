import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Lock,
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

const STATUS_LABELS: Record<string, string> = {
  seeking_funding: 'Open for funding',
  funded: 'Funded',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function expectedYield(amount: number, apr: number, termDays: number): number {
  return amount * (apr / 100) * (termDays / 365)
}

export default async function DashboardInvestmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'investor') {
    redirect('/dashboard')
  }

  const { data: deals } = await supabase
    .from('deals')
    .select(
      `
      id,
      title,
      product_name,
      status,
      amount,
      interest_rate,
      term_days,
      created_at,
      funded_at,
      pyme_id,
      escrow_contract_address,
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name)
    `
    )
    .eq('investor_id', user.id)
    .order('funded_at', { ascending: false })

  const list = deals ?? []

  // Count active escrows (funded/in_progress) per PyME for "open escrows with this PyME"
  const pymeIds = [...new Set((list as { pyme_id: string }[]).map((d) => d.pyme_id).filter(Boolean))]
  const { data: activeCounts } =
    pymeIds.length > 0
      ? await supabase
          .from('deals')
          .select('pyme_id')
          .in('pyme_id', pymeIds)
          .in('status', ['funded', 'in_progress'])
      : { data: [] as { pyme_id: string }[] | null }

  const openEscrowsByPyme: Record<string, number> = {}
  for (const row of activeCounts ?? []) {
    if (row.pyme_id) {
      openEscrowsByPyme[row.pyme_id] = (openEscrowsByPyme[row.pyme_id] ?? 0) + 1
    }
  }

  const totalInvested = list.reduce((sum, d) => sum + Number(d.amount), 0)
  const totalExpectedYield = list.reduce(
    (sum, d) => sum + expectedYield(Number(d.amount), Number(d.interest_rate ?? 0), Number(d.term_days ?? 0)),
    0
  )
  const weightedApr =
    totalInvested > 0
      ? list.reduce(
          (sum, d) =>
            sum + (Number(d.amount) / totalInvested) * Number(d.interest_rate ?? 0),
          0
        )
      : 0

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My investments</h1>
          <p className="text-muted-foreground">
            Deals you have funded. Track progress, yield, and escrow security.
          </p>
        </div>

        {list.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" aria-hidden />
                No investments yet
              </CardTitle>
              <CardDescription>
                Deals you fund will appear here. Browse the marketplace to find deals to fund.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/marketplace">
                  Browse marketplace
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Portfolio overview */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5" aria-hidden />
                  Portfolio overview
                </CardTitle>
                <CardDescription>
                  Summary of your invested capital and expected returns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total invested</p>
                    <p className="text-2xl font-bold tabular-nums">
                      ${totalInvested.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground">USDC across {list.length} deal{list.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Expected yield</p>
                    <p className="text-2xl font-bold text-success tabular-nums">
                      ${totalExpectedYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">At maturity</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Weighted APR</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {weightedApr.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Across portfolio</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security note */}
            <Card className="border-border">
              <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
                <div>
                  <p className="font-medium">Funds are held in escrow</p>
                  <p className="text-sm text-muted-foreground">
                    Your capital is locked in on-chain escrow until milestones are completed. Releases are controlled by the platform and milestones.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Deal list with overview per deal */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Deal overview</h2>
              {list.map((deal) => {
                const d = deal as {
                  id: string
                  title: string
                  product_name: string
                  status: string
                  amount: number
                  interest_rate: number
                  term_days: number
                  funded_at: string | null
                  pyme_id: string
                  escrow_contract_address: string | null
                  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
                }
                const title = d.product_name || d.title
                const statusLabel = STATUS_LABELS[d.status] ?? d.status
                const amount = Number(d.amount)
                const apr = Number(d.interest_rate ?? 0)
                const termDays = Number(d.term_days ?? 0)
                const yieldAmount = expectedYield(amount, apr, termDays)
                const pymeName =
                  d.pyme?.company_name || d.pyme?.full_name || d.pyme?.contact_name || 'PyME'
                const openEscrows = openEscrowsByPyme[d.pyme_id] ?? 0

                return (
                  <Card key={d.id}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-lg">{title}</CardTitle>
                          <CardDescription className="mt-1">
                            With {pymeName} · Funded {d.funded_at ? formatDate(d.funded_at) : '—'}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={
                            d.status === 'funded' || d.status === 'in_progress'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Total amount</p>
                          <p className="text-lg font-semibold tabular-nums">
                            ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-muted-foreground">USDC in escrow</p>
                        </div>
                        <div className="rounded-lg border border-border bg-success/5 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Investor yield</p>
                          <p className="text-lg font-semibold text-success tabular-nums">
                            ${yieldAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">At maturity</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground">APR ({termDays} days)</p>
                          <p className="text-lg font-semibold tabular-nums">{apr}%</p>
                          <p className="text-xs text-muted-foreground">Annualized rate</p>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/5 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Open escrows with this PyME</p>
                          <p className="text-lg font-semibold tabular-nums">{openEscrows}</p>
                          <p className="text-xs text-muted-foreground">
                            {openEscrows <= 1 ? 'This deal' : 'Active deals with same PyME'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {d.escrow_contract_address && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" aria-hidden />
                            <span>Escrow on-chain</span>
                          </div>
                        )}
                        <Button asChild size="sm">
                          <Link href={`/deals/${d.id}`}>
                            View deal details
                            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
