import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
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
  Handshake,
  ShieldCheck,
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

const STATUS_LABELS: Record<string, string> = {
  seeking_funding: 'Open for funding',
  funded: 'Funded',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

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
  pyme_id: string
  milestones: MilestoneRow[]
  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
  investor?: { company_name?: string; full_name?: string; contact_name?: string } | null
}

export default async function DashboardDealsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'supplier') {
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
      created_at,
      funded_at,
      escrow_contract_address,
      pyme_id,
      milestones(id, title, status, percentage, amount),
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name),
      investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name)
    `
    )
    .eq('supplier_id', user.id)
    .order('created_at', { ascending: false })

  const list = (deals ?? []) as DealRow[]

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My deals</h1>
          <p className="text-muted-foreground">
            Deals where you are the supplier. Once funded, accept the deal to unlock 50% and add delivery proof to unlock the rest.
          </p>
        </div>

        {list.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" aria-hidden />
                No deals yet
              </CardTitle>
              <CardDescription>
                Deals where you are selected as the supplier will appear here. PyMEs create deals and choose suppliers from the marketplace.
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
            {/* Short security note */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
                <div>
                  <p className="font-medium">Funds are in escrow</p>
                  <p className="text-sm text-muted-foreground">
                    Complete &quot;Accept deal&quot; to unlock the first 50%. Add delivery proof for the remaining 50% after admin approval.
                  </p>
                </div>
              </CardContent>
            </Card>

            {list.map((deal) => {
              const title = deal.product_name || deal.title
              const statusLabel = STATUS_LABELS[deal.status] ?? deal.status
              const amount = Number(deal.amount)
              const pymeName =
                deal.pyme?.company_name || deal.pyme?.full_name || deal.pyme?.contact_name || 'PyME'
              const investorName =
                deal.investor?.company_name ||
                deal.investor?.full_name ||
                deal.investor?.contact_name ||
                null
              const milestones = deal.milestones ?? []
              const completedCount = milestones.filter((m) => m.status === 'completed').length
              const isFunded = deal.status === 'funded' || deal.status === 'in_progress'
              const hasEscrow = Boolean(deal.escrow_contract_address)

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
                    {/* Deal overview */}
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
                          <p className="text-xs font-medium text-muted-foreground">Escrow</p>
                          <p className="flex items-center gap-1.5 text-sm">
                            {hasEscrow ? (
                              <>
                                <Lock className="h-4 w-4 text-success" aria-hidden />
                                On-chain
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {isFunded ? 'Pending' : 'After funding'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Milestones and next actions */}
                    {milestones.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                          Milestones
                        </h3>
                        <div className="space-y-2">
                          {milestones.map((m, index) => {
                            const isPending = m.status === 'pending'
                            const isInProgress = m.status === 'in_progress'
                            const isCompleted = m.status === 'completed'
                            return (
                              <div
                                key={m.id}
                                className={`flex items-center justify-between gap-4 rounded-lg border p-3 ${
                                  isCompleted ? 'border-success bg-success/5' : 'border-border'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                                  ) : (
                                    <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                                  )}
                                  <div>
                                    <p className="font-medium">
                                      {index === 0 ? 'Accept deal' : index === 1 ? 'Delivery proof' : m.title} — {m.percentage}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {isCompleted
                                        ? 'Completed'
                                        : isInProgress
                                          ? 'Proof uploaded — awaiting approval'
                                          : 'Pending'}
                                    </p>
                                  </div>
                                </div>
                                {isPending && isFunded && hasEscrow && (
                                  <Button asChild size="sm" variant={index === 0 ? 'default' : 'outline'}>
                                    <Link
                                      href={
                                        index === 0
                                          ? `/deals/${deal.id}?action=accept`
                                          : `/deals/${deal.id}?action=delivery`
                                      }
                                    >
                                      {index === 0 ? (
                                        <>
                                          <Handshake className="mr-2 h-4 w-4" aria-hidden />
                                          Accept deal
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="mr-2 h-4 w-4" aria-hidden />
                                          Add delivery proof
                                        </>
                                      )}
                                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {completedCount} of {milestones.length} completed
                        </p>
                      </div>
                    )}

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
    </div>
  )
}
