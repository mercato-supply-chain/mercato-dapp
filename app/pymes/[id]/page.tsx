import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Store,
  Mail,
  Phone,
  ArrowLeft,
  FileText,
  TrendingUp,
  Globe,
  Briefcase,
  Wallet,
  ShieldCheck,
} from 'lucide-react'
import { getCountryLabel, getSectorLabel } from '@/lib/constants'
import {
  aggregateDealsToStats,
  computePymeReputation,
} from '@/lib/pyme-reputation'

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

export default async function PymeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, company_name, bio, full_name, contact_name, email, phone, address, user_type, country, sector, verified')
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
    profile.company_name || profile.full_name || profile.contact_name || 'PYME'

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pymes">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to PYMEs
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Store className="h-7 w-7 text-primary" aria-hidden />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{displayName}</h1>
                {profile.verified && (
                  <Badge
                    variant="secondary"
                    className="mt-2 bg-success/10 text-success"
                  >
                    Verified
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {(profile.country || profile.sector) && (
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
            <p className="mt-4 max-w-2xl text-muted-foreground">{profile.bio}</p>
          )}
        </div>

        {/* Stats + Reputation */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Deals on MERCATO</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{totalDeals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total repaid</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-success">
                {formatPrice(reputation.stats.totalRepaid)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current debt</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatPrice(reputation.stats.currentDebt)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Reputation</CardDescription>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge
                  variant={
                    reputation.tier === 'top_performer'
                      ? 'default'
                      : reputation.tier === 'established'
                        ? 'secondary'
                        : 'outline'
                  }
                  className={
                    reputation.tier === 'top_performer'
                      ? 'bg-success/20 text-success border-success/40'
                      : ''
                  }
                >
                  {reputation.label}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Repayment track record (for investors) */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              Repayment track record
            </CardTitle>
            <CardDescription>
              {reputation.description} Helps investors assess repayment behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Deals completed</p>
              <p className="text-xl font-semibold tabular-nums">
                {reputation.stats.dealsCompleted}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion rate</p>
              <p className="text-xl font-semibold tabular-nums">
                {reputation.completionRate > 0
                  ? `${Math.round(reputation.completionRate * 100)}%`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total repaid</p>
              <p className="text-xl font-semibold tabular-nums text-success">
                {formatPrice(reputation.stats.totalRepaid)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current debt</p>
              <p className="text-xl font-semibold tabular-nums">
                {formatPrice(reputation.stats.currentDebt)}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Contact & details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" aria-hidden />
                Contact &amp; details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <a
                    href={`mailto:${profile.email}`}
                    className="text-accent hover:underline"
                  >
                    {profile.email}
                  </a>
                </div>
              )}
              {profile.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{profile.phone}</span>
                </div>
              )}
              {profile.address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="font-mono text-xs">{profile.address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" aria-hidden />
                Deals
              </CardTitle>
              <CardDescription>
                Deals created by this PYME (supply-chain financing)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dealsList.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No deals yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {dealsList.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/deals/${d.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="font-medium">
                          {d.product_name || d.title || 'Deal'}
                        </span>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="tabular-nums">
                            {formatPrice(d.amount)}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {STATUS_LABELS[d.status] ?? d.status}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {totalDeals > 10 && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
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
