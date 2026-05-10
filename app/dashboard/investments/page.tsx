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
  Activity,
  CheckCircle2,
  BarChart3,
  Clock,
  Package,
  CalendarClock,
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { getServerDictionary } from '@/lib/i18n/server'

function tr(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template)
}

type DealItem = {
  id: string
  title: string
  product_name: string | null
  status: string
  amount: number
  interest_rate: number | null
  term_days: number | null
  created_at: string | null
  funded_at: string | null
  pyme_id: string | null
  escrow_contract_address: string | null
  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expectedYield(amount: number, apr: number, termDays: number): number {
  return amount * (apr / 100) * (termDays / 365)
}

function formatUsd(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function termProgress(fundedAt: string | null, termDays: number | null): {
  percent: number
  daysElapsed: number
  daysRemaining: number
  maturityDate: Date | null
} {
  if (!fundedAt || !termDays || termDays <= 0) {
    return { percent: 0, daysElapsed: 0, daysRemaining: termDays ?? 0, maturityDate: null }
  }
  const start = new Date(fundedAt).getTime()
  const now = Date.now()
  const total = termDays * 86_400_000
  const elapsed = Math.max(0, now - start)
  const daysElapsed = Math.floor(elapsed / 86_400_000)
  const daysRemaining = Math.max(0, termDays - daysElapsed)
  const percent = Math.min(1, elapsed / total)
  const maturityDate = new Date(start + total)
  return { percent, daysElapsed, daysRemaining, maturityDate }
}

function smbName(
  pyme: { company_name?: string; full_name?: string; contact_name?: string } | null | undefined,
  fallback: string,
): string {
  return pyme?.company_name || pyme?.full_name || pyme?.contact_name || fallback
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'funded':
    case 'in_progress':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-transparent'
    case 'completed':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-transparent'
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-transparent'
    default:
      return ''
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardInvestmentsPage() {
  const m = await getServerDictionary()
  const dealStatusLabel = (status: string) => {
    const labels = m.dealStatus as Record<string, string>
    return labels[status] ?? status.replace(/_/g, ' ')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, full_name, company_name, contact_name')
    .eq('id', user.id)
    .single()

  // Start deals fetch before awaiting profile — parallel, not sequential
  const dealsPromise = supabase
    .from('deals')
    .select(
      `id, title, product_name, status, amount, interest_rate, term_days,
       created_at, funded_at, pyme_id, escrow_contract_address,
       pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name)`,
    )
    .eq('investor_id', user.id)
    .order('funded_at', { ascending: false })

  if (profile?.user_type !== 'investor') redirect('/dashboard')

  const { data: deals } = await dealsPromise
  const list = (deals ?? []) as DealItem[]

  // Single pass: partition + aggregate simultaneously
  let totalDeployed = 0
  let activeCapital = 0
  let pendingYield = 0
  let realizedYield = 0
  let weightedAprNumerator = 0
  const activeDeals: DealItem[] = []
  const completedDeals: DealItem[] = []
  const otherDeals: DealItem[] = []

  for (const d of list) {
    const amt = Number(d.amount)
    const apr = Number(d.interest_rate ?? 0)
    const term = Number(d.term_days ?? 0)
    totalDeployed += amt
    if (d.status === 'funded' || d.status === 'in_progress') {
      activeDeals.push(d)
      activeCapital += amt
      pendingYield += expectedYield(amt, apr, term)
      weightedAprNumerator += amt * apr
    } else if (d.status === 'completed') {
      completedDeals.push(d)
      realizedYield += expectedYield(amt, apr, term)
    } else {
      otherDeals.push(d)
    }
  }

  const weightedApr = activeCapital > 0 ? weightedAprNumerator / activeCapital : 0

  // Open escrow count per SMB
  const pymeIds = [...new Set(list.map((d) => d.pyme_id).filter(Boolean))] as string[]
  const { data: activeCounts } =
    pymeIds.length > 0
      ? await supabase
          .from('deals')
          .select('pyme_id')
          .in('pyme_id', pymeIds)
          .in('status', ['funded', 'in_progress'])
      : { data: [] as { pyme_id: string }[] | null }

  const openEscrowsBySmb: Record<string, number> = {}
  for (const row of activeCounts ?? []) {
    if (row.pyme_id) openEscrowsBySmb[row.pyme_id] = (openEscrowsBySmb[row.pyme_id] ?? 0) + 1
  }

  const displayName =
    profile?.company_name || profile?.full_name || profile?.contact_name

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto max-w-5xl px-4 py-8">

        {/* Header */}
        <div className="mb-8 rounded-xl border border-border/50 bg-gradient-to-r from-emerald-500/5 to-transparent px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {displayName
              ? tr(m.investments.titlePossessive, { name: displayName })
              : m.investments.titleDefault}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{m.investments.subtitle}</p>
        </div>

        {list.length === 0 ? (
          /* ── Empty state ── */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <TrendingUp className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">{m.investments.emptyTitle}</h3>
              <p className="mb-6 max-w-xs text-sm text-muted-foreground">{m.investments.emptyDescription}</p>
              <Button asChild>
                <Link href="/deals">
                  {m.investments.browseDeals}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">

            {/* ── Portfolio stats ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {m.investments.totalDeployed}
                  </CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatUsd(totalDeployed)}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {list.length === 1
                      ? tr(m.investments.dealsTotal, { count: list.length })
                      : tr(m.investments.dealsTotalPlural, { count: list.length })}
                  </p>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    {m.investments.activeCapital}
                  </CardDescription>
                  <CardTitle className="text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatUsd(activeCapital)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {activeDeals.length === 1
                      ? tr(m.investments.activeDealsLine, { count: activeDeals.length })
                      : tr(m.investments.activeDealsLinePlural, { count: activeDeals.length })}
                  </p>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                    {m.investments.pendingYield}
                  </CardDescription>
                  <CardTitle className="text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatUsd(pendingYield, 2)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{m.investments.pendingYieldHint}</p>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
                    {completedDeals.length > 0 ? m.investments.realizedYieldShort : m.investments.weightedAprShort}
                  </CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {completedDeals.length > 0 ? formatUsd(realizedYield, 2) : `${weightedApr.toFixed(1)}%`}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {completedDeals.length > 0
                      ? completedDeals.length === 1
                        ? tr(m.investments.completedDealsLine, { count: completedDeals.length })
                        : tr(m.investments.completedDealsLinePlural, { count: completedDeals.length })
                      : m.investments.acrossPortfolio}
                  </p>
                </CardHeader>
              </Card>
            </div>

            {/* ── Security note ── */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{m.investments.securityLead}</span>{' '}
                {m.investments.securityBody}
              </p>
            </div>

            {/* ── Active deals ── */}
            {activeDeals.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{m.investments.activeHeading}</h2>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {activeDeals.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {activeDeals.map((deal) => {
                    const title = deal.product_name || deal.title || m.investments.dealFallbackTitle
                    const amount = Number(deal.amount)
                    const apr = Number(deal.interest_rate ?? 0)
                    const termDays = Number(deal.term_days ?? 0)
                    const yieldAmt = expectedYield(amount, apr, termDays)
                    const smb = smbName(deal.pyme, m.investments.smbFallbackName)
                    const openEscrows = deal.pyme_id ? openEscrowsBySmb[deal.pyme_id] ?? 0 : 0
                    const { percent, daysRemaining, maturityDate } = termProgress(deal.funded_at, deal.term_days)

                    return (
                      <Card key={deal.id} className="border-emerald-200/60 dark:border-emerald-800/30">
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{title}</CardTitle>
                                <CardDescription className="mt-0.5 text-xs">
                                  {m.investments.smbPrefix} {smb}
                                  {deal.funded_at &&
                                    ` · ${tr(m.investments.fundedOn, { date: formatDate(deal.funded_at) })}`}
                                </CardDescription>
                              </div>
                            </div>
                            <Badge className={`text-xs ${statusBadgeClass(deal.status)}`} variant="outline">
                              {dealStatusLabel(deal.status)}
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          {/* Key numbers row */}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground mb-0.5">{m.investments.amount}</p>
                              <p className="text-base font-semibold tabular-nums">{formatUsd(amount)}</p>
                              <p className="text-xs text-muted-foreground">{m.investments.usdcInEscrow}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                              <p className="text-xs text-muted-foreground mb-0.5">{m.investments.expectedYield}</p>
                              <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {formatUsd(yieldAmt, 2)}
                              </p>
                              <p className="text-xs text-muted-foreground">{m.investments.atMaturity}</p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground mb-0.5">{m.investments.apr}</p>
                              <p className="text-base font-semibold tabular-nums">{apr}%</p>
                              <p className="text-xs text-muted-foreground">
                                {tr(m.investments.dayTerm, { n: termDays })}
                              </p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground mb-0.5">{m.investments.openEscrows}</p>
                              <p className="text-base font-semibold tabular-nums">{openEscrows}</p>
                              <p className="text-xs text-muted-foreground">
                                {openEscrows <= 1 ? m.investments.openEscrowsThisOnly : m.investments.openEscrowsSameSmb}
                              </p>
                            </div>
                          </div>

                          {/* Term progress */}
                          {termDays > 0 && (
                            <div>
                              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                                  {m.investments.termProgress}
                                </span>
                                <span className="tabular-nums font-medium">
                                  {daysRemaining > 0
                                    ? tr(m.investments.daysRemaining, { n: daysRemaining })
                                    : maturityDate
                                      ? tr(m.investments.maturedOn, {
                                          date: formatDate(maturityDate.toISOString()),
                                        })
                                      : m.investments.progressEmDash}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                                  style={{ width: `${Math.round(percent * 100)}%` }}
                                />
                              </div>
                              {maturityDate && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {tr(m.investments.maturesOn, {
                                    date: formatDate(maturityDate.toISOString()),
                                  })}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Footer row */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            {deal.escrow_contract_address ? (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3" aria-hidden />
                                {m.investments.securedOnChain}
                              </div>
                            ) : (
                              <span />
                            )}
                            <Button asChild size="sm">
                              <Link href={`/deals/${deal.id}`}>
                                {m.investments.viewDeal}
                                <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden />
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Completed deals ── */}
            {completedDeals.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{m.investments.completedHeading}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {completedDeals.length}
                  </span>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-border">
                      {completedDeals.map((deal) => {
                        const title = deal.product_name || deal.title || m.investments.dealFallbackTitle
                        const amount = Number(deal.amount)
                        const apr = Number(deal.interest_rate ?? 0)
                        const termDays = Number(deal.term_days ?? 0)
                        const yieldAmt = expectedYield(amount, apr, termDays)
                        const smb = smbName(deal.pyme, m.investments.smbFallbackName)

                        return (
                          <li key={deal.id}>
                            <Link
                              href={`/deals/${deal.id}`}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {smb}
                                    {deal.funded_at && ` · ${formatDate(deal.funded_at)}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0 text-right">
                                <div>
                                  <p className="font-medium tabular-nums">{formatUsd(amount)}</p>
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    {tr(m.investments.yieldEarned, { amount: formatUsd(yieldAmt, 2) })}
                                  </p>
                                </div>
                                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass('completed')}`}>
                                  {m.investments.completedBadge}
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* ── Other (cancelled / seeking) ── */}
            {otherDeals.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{m.investments.otherHeading}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {otherDeals.length}
                  </span>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-border">
                      {otherDeals.map((deal) => {
                        const title = deal.product_name || deal.title || m.investments.dealFallbackTitle
                        const amount = Number(deal.amount)
                        const smb = smbName(deal.pyme, m.investments.smbFallbackName)

                        return (
                          <li key={deal.id}>
                            <Link
                              href={`/deals/${deal.id}`}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{title}</p>
                                  <p className="text-xs text-muted-foreground">{smb}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <p className="tabular-nums text-sm">{formatUsd(amount)}</p>
                                <Badge variant="outline" className="text-xs">
                                  {dealStatusLabel(deal.status)}
                                </Badge>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* ── CTA ── */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-5 py-4">
              <div>
                <p className="font-medium text-sm">{m.investments.ctaTitle}</p>
                <p className="text-xs text-muted-foreground">{m.investments.ctaSubtitle}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/deals">
                  {m.investments.browseDealsOutline}
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
