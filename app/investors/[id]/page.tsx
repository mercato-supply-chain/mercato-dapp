import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  ArrowLeft,
  DollarSign,
  Globe,
  Briefcase,
  Phone,
  Mail,
  CheckCircle2,
  Activity,
  BarChart3,
  ExternalLink,
} from 'lucide-react'
import { getCountryLabel, getSectorLabel } from '@/lib/constants'

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

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, full_name, contact_name, user_type')
    .eq('id', id)
    .single()
  if (!profile || profile.user_type !== 'investor') {
    return { title: 'Investor | MERCATO' }
  }
  const name = profile.company_name || profile.full_name || profile.contact_name || 'Investor'
  return {
    title: `${name} | MERCATO`,
    description: `Investor profile and funded deals for ${name} on MERCATO.`,
  }
}

export default async function InvestorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Start deals fetch before awaiting/checking profile — eliminates sequential waterfall
  const dealsPromise = supabase
    .from('deals')
    .select('id, title, product_name, status, amount, created_at')
    .eq('investor_id', id)
    .order('created_at', { ascending: false })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, company_name, bio, full_name, contact_name, email, phone, user_type, country, sector, verified, stake_amount, stake_updated_at')
    .eq('id', id)
    .single()

  if (profileError || !profile || profile.user_type !== 'investor') {
    notFound()
  }

  const { data: fundedDeals } = await dealsPromise

  const allDeals = fundedDeals ?? []
  const dealsList = allDeals.slice(0, 10) as DealRow[]

  const totalInvested = allDeals.reduce((sum, d) => sum + Number(d.amount ?? 0), 0)
  const activeDeals = allDeals.filter((d) => d.status === 'funded' || d.status === 'in_progress').length
  const completedDeals = allDeals.filter((d) => d.status === 'completed').length
  const activeVolume = allDeals
    .filter((d) => d.status === 'funded' || d.status === 'in_progress')
    .reduce((sum, d) => sum + Number(d.amount ?? 0), 0)
  const stakeAmount = Math.max(0, Number(profile.stake_amount ?? 0) || 0)

  const displayName = profile.company_name || profile.full_name || profile.contact_name || 'Investor'
  const initials = getInitials(displayName)

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto max-w-5xl px-4 py-8">

        {/* Back */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/investors">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to investors
            </Link>
          </Button>
        </div>

        {/* Header banner */}
        <div className="mb-8 rounded-xl border border-border/50 bg-gradient-to-r from-emerald-500/5 to-transparent px-6 py-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xl select-none">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
                <Badge variant="secondary" className="text-xs">Investor</Badge>
                {profile.verified && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 text-xs">
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

            {/* Active volume pill */}
            {activeVolume > 0 && (
              <div className="shrink-0 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-center">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 opacity-80 mb-0.5">Active capital</p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatPrice(activeVolume)}
                </p>
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
                Total deals
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{allDeals.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Total deployed
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatPrice(totalInvested)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Active deals
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{activeDeals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{completedDeals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Trust stake
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
                {stakeAmount > 0 ? formatPrice(stakeAmount) : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Contact */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.email && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={`mailto:${profile.email}`} className="truncate text-primary hover:underline">
                    {profile.email}
                  </a>
                </div>
              )}
              {profile.phone && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" aria-hidden />
                  <a href={`tel:${profile.phone}`} className="hover:underline">
                    {profile.phone}
                  </a>
                </div>
              )}
              {!profile.email && !profile.phone && (
                <p className="text-sm text-muted-foreground">No contact details available.</p>
              )}
            </CardContent>
          </Card>

          {/* Funded deals */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Funded deals
              </CardTitle>
              <CardDescription>
                Supply-chain deals funded by this investor on MERCATO
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dealsList.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">No funded deals yet</p>
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
              {allDeals.length > 10 && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Showing latest 10 of {allDeals.length} deals
                </p>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
