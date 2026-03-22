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
  FileText,
  DollarSign,
  Globe,
  Briefcase,
  Phone,
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
  const name =
    profile.company_name ||
    profile.full_name ||
    profile.contact_name ||
    'Investor'
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, company_name, bio, full_name, contact_name, email, phone, user_type, country, sector, verified',
    )
    .eq('id', id)
    .single()

  if (profileError || !profile || profile.user_type !== 'investor') {
    notFound()
  }

  const { data: fundedDeals } = await supabase
    .from('deals')
    .select('id, title, product_name, status, amount, created_at')
    .eq('investor_id', id)
    .order('created_at', { ascending: false })

  const dealsList = (fundedDeals ?? []).slice(0, 10) as DealRow[]
  const totalInvested = (fundedDeals ?? []).reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const dealsCompleted = (fundedDeals ?? []).filter(
    (d) => d.status === 'completed' || d.status === 'cancelled'
  ).length

  const displayName =
    profile.company_name || profile.full_name || profile.contact_name || 'Investor'

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
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/investors">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to investors
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/deals">Deals</Link>
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-success/10">
                <TrendingUp className="h-7 w-7 text-success" aria-hidden />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{displayName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Investor</Badge>
                  {profile.verified && (
                    <Badge
                      variant="secondary"
                      className="bg-success/10 text-success"
                    >
                      Verified
                    </Badge>
                  )}
                </div>
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

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Deals funded</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {fundedDeals?.length ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total invested</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-success">
                {formatPrice(totalInvested)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Deals completed</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {dealsCompleted}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" aria-hidden />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.email ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <a
                    href={`mailto:${profile.email}`}
                    className="text-accent hover:underline"
                  >
                    {profile.email}
                  </a>
                </div>
              ) : null}
              {profile.phone ? (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={`tel:${profile.phone}`} className="hover:underline">
                    {profile.phone}
                  </a>
                </div>
              ) : null}
              {!profile.email && !profile.phone && (
                <p className="text-sm text-muted-foreground">
                  Contact information not shared
                </p>
              )}
            </CardContent>
          </Card>

          {/* Funded deals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" aria-hidden />
                Funded deals
              </CardTitle>
              <CardDescription>
                Deals this investor has funded on MERCATO
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dealsList.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No funded deals yet
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
              {(fundedDeals?.length ?? 0) > 10 && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Showing latest 10 of {fundedDeals?.length} deals
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
