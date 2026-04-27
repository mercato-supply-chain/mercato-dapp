import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Package,
  TrendingUp,
  Users,
  Plus,
  ArrowRight,
  DollarSign,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  Building2,
  Wallet,
  BarChart3,
  Activity,
  AlertCircle,
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { getServerDictionary } from '@/lib/i18n/server'

type DashboardSearchParams = Promise<{ company?: string }> | { company?: string }

type DealRow = {
  id: string
  title?: string
  product_name?: string
  description?: string
  status: string
  amount: number
  term_days?: number
  interest_rate?: number
  created_at?: string
  funded_at?: string | null
  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
  supplier?: { company_name?: string; full_name?: string; contact_name?: string } | null
  investor?: { company_name?: string; full_name?: string; contact_name?: string } | null
  milestones?: Array<{ id: string; status: string }> | null
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'completed') return 'default'
  if (status === 'funded' || status === 'in_progress') return 'secondary'
  if (status === 'cancelled') return 'destructive'
  return 'outline'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: DashboardSearchParams
}) {
  const supabase = await createClient()
  const t = await getServerDictionary()

  const params = searchParams
    ? typeof (searchParams as Promise<{ company?: string }>).then === 'function'
      ? await (searchParams as Promise<{ company?: string }>)
      : (searchParams as { company?: string })
    : {}
  const companyFilterId = params.company ?? null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const userType = profile?.user_type || 'pyme'
  const fullName = profile?.full_name || profile?.contact_name || user.email
  const companyName = profile?.company_name

  let deals: DealRow[] = []
  let supplierCompanies: { id: string; company_name: string | null }[] = []
  let supplierProductsForCard: { categories: string[]; products: string[] } | null = null
  let adminStats: {
    totalDeals: number
    seekingFunding: number
    activeDeals: number
    completedDeals: number
    pendingApprovals: number
  } | null = null
  let roleStats: { total: number; active: number; completed: number } | null = null

  if (userType === 'pyme') {
    const [{ data }, { count: total }, { count: active }, { count: completed }] = await Promise.all([
      supabase
        .from('deals')
        .select('id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, milestones(id, status)')
        .eq('pyme_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('pyme_id', user.id),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('pyme_id', user.id).in('status', ['funded', 'in_progress']),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('pyme_id', user.id).eq('status', 'completed'),
    ])
    deals = (data || []) as typeof deals
    roleStats = { total: total ?? 0, active: active ?? 0, completed: completed ?? 0 }
  } else if (userType === 'investor') {
    const [{ data }, { count: total }, { count: active }, { count: completed }] = await Promise.all([
      supabase
        .from('deals')
        .select('id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), milestones(id, status)')
        .eq('investor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('investor_id', user.id),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('investor_id', user.id).in('status', ['funded', 'in_progress']),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('investor_id', user.id).eq('status', 'completed'),
    ])
    deals = (data || []) as typeof deals
    roleStats = { total: total ?? 0, active: active ?? 0, completed: completed ?? 0 }
  } else if (userType === 'supplier') {
    const { data: myCompanies } = await supabase
      .from('supplier_companies')
      .select('id, company_name')
      .eq('owner_id', user.id)
    supplierCompanies = myCompanies ?? []
    const companyIds = supplierCompanies.map((c) => c.id)
    if (companyIds.length > 0) {
      const filterByCompany =
        companyFilterId && companyIds.includes(companyFilterId) ? companyFilterId : null
      const dealsBase = filterByCompany
        ? supabase.from('deals').filter('supplier_id', 'eq', filterByCompany)
        : supabase.from('deals').filter('supplier_id', 'in', `(${companyIds.map((id) => `"${id}"`).join(',')})`)

      const [{ data }, { count: total }, { count: active }, { count: completed }] = await Promise.all([
        (filterByCompany
          ? supabase.from('deals').select(
              'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name), milestones(id, status)'
            ).eq('supplier_id', filterByCompany)
          : supabase.from('deals').select(
              'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name), milestones(id, status)'
            ).in('supplier_id', companyIds)
        ).order('created_at', { ascending: false }).limit(10),
        dealsBase.select('*', { count: 'exact', head: true }),
        (filterByCompany
          ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
          : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)
        ).in('status', ['funded', 'in_progress']),
        (filterByCompany
          ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
          : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)
        ).eq('status', 'completed'),
      ])
      deals = (data || []) as typeof deals
      roleStats = { total: total ?? 0, active: active ?? 0, completed: completed ?? 0 }

      const companyForCard =
        filterByCompany ?? (supplierCompanies.length === 1 ? supplierCompanies[0].id : null)
      if (companyForCard) {
        const { data: products } = await supabase
          .from('supplier_products')
          .select('name, category')
          .eq('supplier_id', companyForCard)
        const productList = products ?? []
        const categories = [...new Set(productList.map((p) => (p as { category: string }).category).filter(Boolean))]
        const productNames = productList.map((p) => (p as { name: string }).name).filter(Boolean)
        supplierProductsForCard = { categories, products: productNames }
      }
    }
  } else if (userType === 'admin') {
    const [
      { count: totalDeals },
      { count: seekingFunding },
      { count: fundedCount },
      { count: inProgressCount },
      { count: completedCount },
      { data: recentDeals },
      { count: pendingApprovals },
    ] = await Promise.all([
      supabase.from('deals').select('*', { count: 'exact', head: true }),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'seeking_funding'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'funded'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase
        .from('deals')
        .select(
          'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name), investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name), milestones(id, status)'
        )
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('milestones').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    ])
    deals = (recentDeals || []) as typeof deals
    adminStats = {
      totalDeals: totalDeals ?? 0,
      seekingFunding: seekingFunding ?? 0,
      activeDeals: (fundedCount ?? 0) + (inProgressCount ?? 0),
      completedDeals: completedCount ?? 0,
      pendingApprovals: pendingApprovals ?? 0,
    }
  }

  const roleConfig = {
    pyme: {
      icon: <Package className="h-4 w-4" />,
      label: t.dashboard.roles.pyme,
      tagline: t.dashboard.roles.pymeTagline,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'from-blue-50/60 to-transparent dark:from-blue-950/20',
    },
    investor: {
      icon: <TrendingUp className="h-4 w-4" />,
      label: t.dashboard.roles.investor,
      tagline: t.dashboard.roles.investorTagline,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'from-emerald-50/60 to-transparent dark:from-emerald-950/20',
    },
    supplier: {
      icon: <Users className="h-4 w-4" />,
      label: t.dashboard.roles.supplier,
      tagline: t.dashboard.roles.supplierTagline,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'from-purple-50/60 to-transparent dark:from-purple-950/20',
    },
    admin: {
      icon: <ShieldCheck className="h-4 w-4" />,
      label: t.dashboard.roles.admin,
      tagline: t.dashboard.roles.adminTagline,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'from-orange-50/60 to-transparent dark:from-orange-950/20',
    },
  }

  const role = roleConfig[userType as keyof typeof roleConfig] ?? roleConfig.pyme

  type QuickAction = { label: string; description: string; href: string; icon: React.ElementType }

  const getQuickActions = (): QuickAction[] => {
    const rampAction: QuickAction = {
      label: t.dashboard.actions.ramp,
      description: t.dashboard.actions.rampDescription,
      href: '/dashboard/ramp',
      icon: Wallet,
    }
    switch (userType) {
      case 'pyme':
        return [
          { label: t.dashboard.actions.create, description: t.dashboard.actions.createDescription, href: '/create-deal', icon: Plus },
          { label: t.nav.browseInvestors, description: t.dashboard.actions.browseInvestorsDescription, href: '/deals?filter=funded', icon: TrendingUp },
          rampAction,
        ]
      case 'investor':
        return [
          { label: t.nav.browseDeals, description: t.dashboard.actions.browseDealsDescription, href: '/deals', icon: Package },
          { label: t.nav.myInvestments, description: t.dashboard.actions.myInvestmentsDescription, href: '/dashboard/investments', icon: DollarSign },
          rampAction,
        ]
      case 'supplier':
        return [
          { label: t.dashboard.actions.manageCompanies, description: t.dashboard.actions.manageCompaniesDescription, href: '/dashboard/supplier-profile', icon: Building2 },
          { label: t.dashboard.actions.viewActiveDeals, description: t.dashboard.actions.viewActiveDealsDescription, href: '/dashboard/deals', icon: TrendingUp },
          { label: t.dashboard.actions.confirmDeliveries, description: t.dashboard.actions.confirmDeliveriesDescription, href: '/dashboard/deliveries', icon: CheckCircle2 },
          rampAction,
        ]
      case 'admin':
        return [
          { label: t.nav.milestoneApprovals, description: t.dashboard.actions.milestoneApprovalsDescription, href: '/dashboard/admin', icon: ShieldCheck },
          { label: t.dashboard.actions.browseAllDeals, description: t.dashboard.actions.browseAllDealsDescription, href: '/deals', icon: Package },
          rampAction,
        ]
      default:
        return [rampAction]
    }
  }

  const dealsViewAllHref =
    userType === 'supplier' ? '/dashboard/deals' : '/deals'

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Welcome header */}
        <div className={`mb-8 rounded-xl bg-gradient-to-r ${role.bg} border border-border/50 px-6 py-5`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t.dashboard.welcome.replace('{name}', fullName?.split(' ')[0] || t.dashboard.there)}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={`gap-1.5 ${role.color}`}>
                  {role.icon}
                  {role.label}
                </Badge>
                {companyName && (
                  <span className="text-sm text-muted-foreground">{t.dashboard.atCompany.replace('{company}', companyName)}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{role.tagline}</p>
            </div>
            {userType === 'pyme' && (
              <Button asChild size="sm">
                <Link href="/create-deal">
                  <Plus className="mr-2 h-4 w-4" />
                  {t.dashboard.newDeal}
                </Link>
              </Button>
            )}
            {userType === 'investor' && (
              <Button asChild size="sm">
                <Link href="/deals">
                  {t.nav.browseDeals}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Supplier: Company filter */}
        {userType === 'supplier' && supplierCompanies.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t.dashboard.company}</span>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant={!companyFilterId ? 'default' : 'outline'} size="sm">
                <Link href="/dashboard">{t.dashboard.allCompanies}</Link>
              </Button>
              {supplierCompanies.map((c) => (
                <Button
                  key={c.id}
                  asChild
                  variant={companyFilterId === c.id ? 'default' : 'outline'}
                  size="sm"
                >
                  <Link href={`/dashboard?company=${c.id}`}>
                    {c.company_name || t.dashboard.unnamedCompany}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Admin: stats grid + pending callout */}
        {userType === 'admin' && adminStats && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {t.deals.totalDeals}
                  </CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.totalDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {t.dealStatus.seeking_funding}
                  </CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.seekingFunding}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {t.deals.active}
                  </CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.activeDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t.deals.completed}
                  </CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.completedDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 min-w-0">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {t.dashboard.pendingApprovals}
                  </CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.pendingApprovals}</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                  <Button
                    asChild
                    size="sm"
                    variant={adminStats.pendingApprovals > 0 ? 'default' : 'secondary'}
                    className="w-full min-w-0 justify-center"
                  >
                    <Link href="/dashboard/admin">
                      {adminStats.pendingApprovals > 0 ? t.dashboard.reviewNow : t.dashboard.view}
                      <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {adminStats.pendingApprovals > 0 && (
              <Card className="mb-8 border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                      <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium">{t.dashboard.adminPendingTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.dashboard.adminPendingText
                          .replace('{count}', String(adminStats.pendingApprovals))
                          .replace('{plural}', adminStats.pendingApprovals !== 1 ? 's' : '')}
                      </p>
                    </div>
                  </div>
                  <Button asChild>
                    <Link href="/dashboard/admin">
                      {t.dashboard.goApprovals}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Role stats (non-admin) */}
        {userType !== 'admin' && roleStats && (
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {t.dashboard.totalDeals}
                  {userType === 'supplier' && !companyFilterId && supplierCompanies.length > 1 && (
                    <span className="ml-auto text-xs font-normal">{supplierCompanies.length} companies</span>
                  )}
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">{roleStats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  {t.dashboard.activeDeals}
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">{roleStats.active}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t.dashboard.completed}
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">{roleStats.completed}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">

          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <h2 className="text-base font-semibold mb-3">{t.dashboard.quickActions}</h2>
            <div className="flex flex-col gap-2">
              {getQuickActions().map((action) => (
                <Button
                  key={action.href}
                  asChild
                  variant="outline"
                  className="h-auto justify-start p-4 bg-transparent text-left"
                >
                  <Link href={action.href}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted mr-3">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{action.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{action.description}</p>
                    </div>
                    <ArrowRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </Button>
              ))}
            </div>

            {/* Supplier: Products card */}
            {userType === 'supplier' && (
              <Card className="mt-6">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Package className="h-4 w-4" />
                    My Products & Categories
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {companyFilterId || supplierCompanies.length === 1
                      ? 'Your catalog visible to SMBs creating deals'
                      : 'Select a company above to see its catalog'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {supplierProductsForCard ? (
                    <div className="space-y-3">
                      {supplierProductsForCard.categories.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Categories</p>
                          <div className="flex flex-wrap gap-1.5">
                            {supplierProductsForCard.categories.map((cat) => (
                              <Badge key={cat} variant="secondary" className="capitalize text-xs">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {supplierProductsForCard.products.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Products</p>
                          <div className="flex flex-wrap gap-1.5">
                            {supplierProductsForCard.products.slice(0, 8).map((product) => (
                              <Badge key={product} variant="outline" className="text-xs">
                                {product}
                              </Badge>
                            ))}
                            {supplierProductsForCard.products.length > 8 && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                +{supplierProductsForCard.products.length - 8} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {supplierProductsForCard.categories.length === 0 && supplierProductsForCard.products.length === 0 && (
                        <p className="text-xs text-muted-foreground">No products yet for this company.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {supplierCompanies.length === 0
                        ? 'Add a company to set up your product catalog.'
                        : 'Select a company above to view products.'}
                    </p>
                  )}
                  <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                    <Link href="/dashboard/supplier-profile">
                      Manage catalog
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Deals */}
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {userType === 'admin' ? 'Recent platform deals' : 'Recent Deals'}
              </h2>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href={dealsViewAllHref}>
                  View all
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {deals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold">No deals yet</h3>
                  <p className="mb-5 text-sm text-muted-foreground max-w-xs">
                    {userType === 'pyme' && 'Create your first deal to start securing supply chain financing.'}
                    {userType === 'investor' && 'Browse open deals to fund your first investment.'}
                    {userType === 'supplier' &&
                      (supplierCompanies.length === 0
                        ? 'Add a company and products so SMBs can create deals with you.'
                        : "Deals assigned to your companies will appear here once investors fund them.")}
                    {userType === 'admin' && 'No deals on the platform yet.'}
                  </p>
                  {userType === 'pyme' && (
                    <Button asChild>
                      <Link href="/create-deal">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Deal
                      </Link>
                    </Button>
                  )}
                  {userType === 'supplier' && supplierCompanies.length === 0 && (
                    <Button asChild>
                      <Link href="/dashboard/supplier-profile">
                        Add Company & Products
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {(userType === 'investor' || userType === 'admin') && (
                    <Button asChild>
                      <Link href="/deals">Browse deals</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left font-medium p-4">Deal</th>
                          <th className="text-left font-medium p-4">Status</th>
                          <th className="text-right font-medium p-4">Amount</th>
                          {userType === 'admin' && (
                            <>
                              <th className="text-left font-medium p-4 hidden lg:table-cell">SMB (Buyer)</th>
                              <th className="text-left font-medium p-4 hidden lg:table-cell">Supplier</th>
                              <th className="text-left font-medium p-4 hidden xl:table-cell">Investor</th>
                              <th className="text-left font-medium p-4 hidden xl:table-cell">Funded</th>
                            </>
                          )}
                          {userType === 'supplier' && (
                            <>
                              <th className="text-left font-medium p-4 hidden lg:table-cell">Company</th>
                              <th className="text-left font-medium p-4 hidden lg:table-cell">SMB (Buyer)</th>
                            </>
                          )}
                          {userType === 'investor' && (
                            <th className="text-left font-medium p-4 hidden lg:table-cell">SMB (Buyer)</th>
                          )}
                          {userType === 'pyme' && (
                            <th className="text-left font-medium p-4 hidden lg:table-cell">Created</th>
                          )}
                          <th className="text-center font-medium p-4 hidden sm:table-cell">Milestones</th>
                          <th className="text-right font-medium p-4 w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deals.map((deal) => {
                          const pymeName = deal.pyme?.company_name || deal.pyme?.full_name || deal.pyme?.contact_name || '—'
                          const supplierName = deal.supplier?.company_name || deal.supplier?.full_name || deal.supplier?.contact_name || '—'
                          const investorName = deal.investor?.company_name || deal.investor?.full_name || deal.investor?.contact_name || '—'
                          const milestones = deal.milestones ?? []
                          const completed = milestones.filter((m) => m.status === 'completed').length
                          const pending = milestones.filter((m) => m.status === 'in_progress').length
                          const total = milestones.length
                          const hasPendingApproval = pending > 0
                          const statusLabel =
                            t.dealStatus[deal.status as keyof typeof t.dealStatus] ??
                            deal.status

                          return (
                            <tr key={deal.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="p-4">
                                <div>
                                  <Link
                                    href={`/deals/${deal.id}`}
                                    className="font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                                  >
                                    {deal.product_name || deal.title || 'Deal'}
                                  </Link>
                                  {deal.term_days != null && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {deal.term_days}d · {deal.interest_rate ?? '—'}% APR
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge variant={statusBadgeVariant(deal.status)} className="whitespace-nowrap">
                                  {statusLabel}
                                </Badge>
                              </td>
                              <td className="p-4 text-right tabular-nums font-medium">
                                ${Number(deal.amount).toLocaleString()}
                              </td>

                              {userType === 'admin' && (
                                <>
                                  <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs">{pymeName}</td>
                                  <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs">{supplierName}</td>
                                  <td className="p-4 hidden xl:table-cell text-muted-foreground text-xs">{investorName}</td>
                                  <td className="p-4 hidden xl:table-cell text-muted-foreground text-xs">
                                    {deal.funded_at ? formatDate(deal.funded_at) : '—'}
                                  </td>
                                </>
                              )}
                              {userType === 'supplier' && (
                                <>
                                  <td className="p-4 hidden lg:table-cell font-medium text-xs">{supplierName}</td>
                                  <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs">{pymeName}</td>
                                </>
                              )}
                              {userType === 'investor' && (
                                <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs">{pymeName}</td>
                              )}
                              {userType === 'pyme' && (
                                <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs">
                                  {deal.created_at ? formatDate(deal.created_at) : '—'}
                                </td>
                              )}

                              <td className="p-4 text-center hidden sm:table-cell">
                                {total > 0 ? (
                                  <span
                                    className={hasPendingApproval ? 'text-amber-600 dark:text-amber-400 font-medium text-xs' : 'text-xs text-muted-foreground'}
                                    title={hasPendingApproval ? 'Has milestone(s) awaiting approval' : ''}
                                  >
                                    {completed}/{total}
                                    {hasPendingApproval && ' ·'}
                                    {hasPendingApproval && (
                                      <span className="ml-1 inline-flex items-center gap-0.5">
                                        <AlertCircle className="h-3 w-3" />
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                    <Link href={`/deals/${deal.id}`}>
                                      {userType === 'supplier' && hasPendingApproval ? 'Act' : 'View'}
                                      <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
                                    </Link>
                                  </Button>
                                  {userType === 'admin' && hasPendingApproval && (
                                    <Button asChild size="sm" className="h-7 px-2 text-xs">
                                      <Link href="/dashboard/admin">Approve</Link>
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 bg-muted/20">
                    <p className="text-xs text-muted-foreground">
                      Showing {deals.length} of {roleStats?.total ?? adminStats?.totalDeals ?? deals.length} total
                    </p>
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link href={dealsViewAllHref}>
                        View all deals
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
