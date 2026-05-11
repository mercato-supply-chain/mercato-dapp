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
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getServerLocale, getServerDictionary, tr, formatMoneyServer } from '@/lib/i18n/server'

type DealRow = {
  id: string
  title: string
  product_name: string | null
  status: string
  amount: number
  created_at: string | null
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

function dealStatusLabel(m: Awaited<ReturnType<typeof getServerDictionary>>, status: string): string {
  const label = tr(m, `deals.${status}`)
  if (label === `deals.${status}`) return status
  return label
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const locale = await getServerLocale()
  const m = getDictionary(locale)
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, full_name, contact_name, user_type')
    .eq('id', id)
    .single()
  if (!profile || profile.user_type !== 'investor') {
    return { title: tr(m, 'investorDetail.metaTitle') }
  }
  const name =
    profile.company_name ||
    profile.full_name ||
    profile.contact_name ||
    tr(m, 'investorDetail.fallbackName')
  return {
    title: `${name} | ${m.common.brand}`,
    description: tr(m, 'investorDetail.metaDescription', { name }),
  }
}

export default async function InvestorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const m = await getServerDictionary()
  const locale = await getServerLocale()

  const dealsPromise = supabase
    .from('deals')
    .select('id, title, product_name, status, amount, created_at')
    .eq('investor_id', id)
    .order('created_at', { ascending: false })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, company_name, bio, full_name, contact_name, email, phone, user_type, country, sector, verified')
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
  const stakeAmount = 0

  const displayName =
    profile.company_name || profile.full_name || profile.contact_name || tr(m, 'investorDetail.fallbackName')
  const initials = getInitials(displayName)

  const formatPrice = (value: number) => formatMoneyServer(locale, value)

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto max-w-5xl px-4 py-8">

        {/* Back */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/investors">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              {tr(m, 'investorDetail.backToDirectory')}
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
                <Badge variant="secondary" className="text-xs">{tr(m, 'investorDetail.badgeInvestor')}</Badge>
                {profile.verified && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    {tr(m, 'investorDetail.verified')}
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
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 opacity-80 mb-0.5">
                  {tr(m, 'investorDetail.activeCapital')}
                </p>
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
                {tr(m, 'investorDetail.statTotalDeals')}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{allDeals.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                {tr(m, 'investorDetail.statTotalDeployed')}
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
                {tr(m, 'investorDetail.statActiveDeals')}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{activeDeals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {tr(m, 'investorDetail.statCompleted')}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">{completedDeals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                {tr(m, 'investorDetail.trustStake')}
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
              <CardTitle className="text-base">{tr(m, 'investorDetail.contactTitle')}</CardTitle>
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
                <p className="text-sm text-muted-foreground">{tr(m, 'investorDetail.noContact')}</p>
              )}
            </CardContent>
          </Card>

          {/* Funded deals */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" aria-hidden />
                {tr(m, 'investorDetail.fundedDealsTitle')}
              </CardTitle>
              <CardDescription>{tr(m, 'investorDetail.fundedDealsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {dealsList.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">{tr(m, 'investorDetail.noDeals')}</p>
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
                          {d.product_name || d.title || tr(m, 'adminPage.fallbackDeal')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-muted-foreground">
                            {formatPrice(d.amount)}
                          </span>
                          <Badge variant={STATUS_BADGE_VARIANT[d.status] ?? 'outline'} className="text-xs">
                            {dealStatusLabel(m, d.status)}
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
                  {tr(m, 'investorDetail.showingLatest', { shown: 10, total: allDeals.length })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
