import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Mail,
  Phone,
  ArrowLeft,
  TrendingUp,
  Globe,
  Briefcase,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Activity,
  BarChart3,
  ExternalLink,
} from 'lucide-react'
import { getCountryLabel, getSectorLabel } from '@/lib/constants'
import {
  aggregateDealsToStats,
  computePymeReputation,
  type PymeReputationTier,
} from '@/lib/pyme-reputation'
import { ReputationTooltip } from '@/components/reputation-tooltip'

type DealRow = {
  id: string
  title: string
  product_name: string | null
  status: string
  amount: number
  created_at: string | null
}

const STATUS_LABELS: Record<string, string> = {
  seeking_funding: 'Open for funding',
  funded: 'Funded',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  completed: 'default',
  funded: 'secondary',
  in_progress: 'secondary',
  seeking_funding: 'outline',
  cancelled: 'destructive',
}

const TIER_STYLES: Record<PymeReputationTier, string> = {
  top_performer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  established: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  building: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  new: 'bg-muted text-muted-foreground border-border',
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

export default async function SmbDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, company_name, bio, full_name, contact_name, email, phone, address, user_type, country, sector, verified, stake_amount, stake_updated_at')
    .eq('id', id)
    .single()

  if (profileError || !profile || profile.user_type !== 'pyme') {
    notFound()
  }

  const { data: allDeals } = await supabase
    .from('deals')
    .select('id, title, product_name, status, amount, created_at')
    .eq('pyme_id', id)
    .order('created_at', { ascending: false })

  const dealsList = (allDeals ?? []).slice(0, 10) as DealRow[]
  const totalDeals = (allDeals ?? []).length

  const reputationStats = aggregateDealsToStats(
    (allDeals ?? []).map((d) => ({ status: d.status, amount: d.amount }))
  )
  const reputation = computePymeReputation(reputationStats)

  const displayName =
    profile.company_name || profile.full_name || profile.contact_name || 'SMB'

  const initials = getInitials(displayName)

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  const stakeAmount = Math.max(0, Number(profile.stake_amount ?? 0) || 0)

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto max-w-5xl px-4 py-8">

        {/* Back link */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pymes">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to SMBs
            </Link>
          </Button>
        </div>

        {/* Header banner */}
        <div className="mb-8 rounded-xl border border-border/50 bg-gradient-to-r from-primary/5 to-transparent px-6 py-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl select-none">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
                {profile.verified && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>

              {(profile.country || profile.sector) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {profile.sector && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
                      {getSectorLabel(profile.sector)}
                    </span>
                  )}
                  {profile.country && (
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4 shrink-0" aria-hidden />
                      {getCountryLabel(profile.country)}
                    </span>
                  )}
                </div>
              )}

              {profile.bio && (
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground leading-relaxed">
                  {profile.bio}
                </p>
              )}
            </div>

            {/* Reputation badge */}
            {reputation.tier !== 'new' && (
              <div className={`shrink-0 rounded-lg border px-3 py-2 text-center ${TIER_STYLES[reputation.tier]}`}>
                <div className="mb-0.5 flex items-center justify-center gap-1">
                  <p className="text-xs font-medium opacity-70">Reputation</p>
                  <ReputationTooltip
                    reputation={reputation}
                    side="bottom"
                    align="end"
                    triggerClassName="h-4 w-4 text-current opacity-60 hover:opacity-100 hover:bg-transparent"
                  />
                </div>
                <p className="text-sm font-semibold">{reputation.label}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Deals on MERCATO
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{totalDeals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Active deals
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {reputationStats.dealsFunded - reputationStats.dealsCompleted > 0
                  ? reputationStats.dealsFunded - reputationStats.dealsCompleted
                  : 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Total repaid
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatPrice(reputation.stats.totalRepaid)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Completion rate
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {reputation.completionRate > 0
                  ? `${Math.round(reputation.completionRate * 100)}%`
                  : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Trust stake
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums text-primary">
                {stakeAmount > 0 ? formatPrice(stakeAmount) : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Repayment track record */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              Repayment track record
              <ReputationTooltip reputation={reputation} side="bottom" align="start" />
            </CardTitle>
            <CardDescription>{reputation.description} Helps investors assess repayment behavior.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Deals funded</p>
                <p className="text-2xl font-semibold tabular-nums">{reputationStats.dealsFunded}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Deals completed</p>
                <p className="text-2xl font-semibold tabular-nums">{reputationStats.dealsCompleted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total repaid</p>
                <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatPrice(reputationStats.totalRepaid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current debt</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatPrice(reputationStats.currentDebt)}
                </p>
              </div>
            </div>

            {reputation.completionRate > 0 && (
              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Completion rate</span>
                  <span className="font-medium tabular-nums">
                    {Math.round(reputation.completionRate * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round(reputation.completionRate * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Contact & details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Contact &amp; details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.email && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <a
                    href={`mailto:${profile.email}`}
                    className="truncate text-primary hover:underline"
                  >
                    {profile.email}
                  </a>
                </div>
              )}
              {profile.phone && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{profile.phone}</span>
                </div>
              )}
              {profile.address && (
                <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                  <span className="font-mono text-xs break-all">{profile.address}</span>
                </div>
              )}
              {!profile.email && !profile.phone && !profile.address && (
                <p className="text-sm text-muted-foreground">No contact details available.</p>
              )}
            </CardContent>
          </Card>

          {/* Deals */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Deals
              </CardTitle>
              <CardDescription>
                Supply-chain financing deals created by this SMB
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dealsList.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">No deals yet</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {dealsList.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/deals/${d.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="font-medium">
                          {d.product_name || d.title || 'Deal'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-muted-foreground">
                            {formatPrice(d.amount)}
                          </span>
                          <Badge variant={STATUS_BADGE_VARIANT[d.status] ?? 'outline'} className="text-xs">
                            {STATUS_LABELS[d.status] ?? d.status}
                          </Badge>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {totalDeals > 10 && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Showing latest 10 of {totalDeals} deals
                </p>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
