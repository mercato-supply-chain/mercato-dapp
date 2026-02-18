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
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const userType = profile?.user_type || 'pyme'
  const fullName = profile?.full_name || profile?.contact_name || user.email
  const companyName = profile?.company_name

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

  let deals: DealRow[] = []
  let adminStats: {
    totalDeals: number
    seekingFunding: number
    activeDeals: number
    completedDeals: number
    pendingApprovals: number
  } | null = null

  if (userType === 'pyme') {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('pyme_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    deals = (data || []) as typeof deals
  } else if (userType === 'investor') {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('investor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    deals = (data || []) as typeof deals
  } else if (userType === 'supplier') {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    deals = (data || []) as typeof deals
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
          `id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at,
          pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name),
          supplier:profiles!deals_supplier_id_fkey(company_name, full_name, contact_name),
          investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name),
          milestones(id, status)`
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

  const getRoleIcon = () => {
    switch (userType) {
      case 'pyme':
        return <Package className="h-5 w-5" />
      case 'investor':
        return <TrendingUp className="h-5 w-5" />
      case 'supplier':
        return <Users className="h-5 w-5" />
      case 'admin':
        return <ShieldCheck className="h-5 w-5" />
      default:
        return <Package className="h-5 w-5" />
    }
  }

  const getRoleLabel = () => {
    switch (userType) {
      case 'pyme':
        return 'PyME (Buyer)'
      case 'investor':
        return 'Investor'
      case 'supplier':
        return 'Supplier'
      case 'admin':
        return 'Admin'
      default:
        return 'User'
    }
  }

  const getQuickActions = () => {
    switch (userType) {
      case 'pyme':
        return [
          { label: 'Create New Deal', href: '/create-deal', icon: Plus },
          { label: 'Browse Investors', href: '/marketplace?filter=funded', icon: TrendingUp },
        ]
      case 'investor':
        return [
          { label: 'Browse Deals', href: '/marketplace', icon: Package },
          { label: 'My Investments', href: '/dashboard/investments', icon: DollarSign },
        ]
      case 'supplier':
        return [
          { label: 'Manage Products & Categories', href: '/dashboard/supplier-profile', icon: Package },
          { label: 'View Active Deals', href: '/dashboard/deals', icon: TrendingUp },
          { label: 'Upload Delivery Proof', href: '/dashboard/deliveries', icon: CheckCircle2 },
        ]
      case 'admin':
        return [
          { label: 'Milestone approvals', href: '/dashboard/admin', icon: ShieldCheck },
          { label: 'View marketplace', href: '/marketplace', icon: Package },
        ]
      default:
        return []
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Welcome back, {fullName?.split(' ')[0] || 'User'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              {getRoleIcon()}
              {getRoleLabel()}
            </Badge>
            {companyName && (
              <span className="text-muted-foreground">at {companyName}</span>
            )}
          </div>
        </div>

        {/* Supplier: My Products & Categories */}
        {userType === 'supplier' && (profile?.products?.length > 0 || profile?.categories?.length > 0) && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                My Products & Categories
              </CardTitle>
              <CardDescription>
                Your catalog that PyMEs see when creating deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profile?.categories && profile.categories.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.categories.map((cat: string) => (
                        <Badge key={cat} variant="secondary" className="capitalize">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {profile?.products && profile.products.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Products</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.products.map((product: string) => (
                        <Badge key={product} variant="outline">
                          {product}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/dashboard/supplier-profile">
                  Manage Products & Categories
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Admin: Overview stats + pending approvals callout */}
        {userType === 'admin' && adminStats && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total deals</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.totalDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Seeking funding</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.seekingFunding}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Active (funded / in progress)</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.activeDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Completed</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.completedDeals}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-primary/20 bg-primary/5 min-w-0">
                <CardHeader className="pb-3">
                  <CardDescription>Pending milestone approvals</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{adminStats.pendingApprovals}</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                  <Button asChild size="sm" variant={adminStats.pendingApprovals > 0 ? 'default' : 'secondary'} className="w-full min-w-0 justify-center">
                    <Link href="/dashboard/admin">
                      Approve
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
                    <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
                    <div>
                      <p className="font-medium">Milestones awaiting release</p>
                      <p className="text-sm text-muted-foreground">
                        {adminStats.pendingApprovals} milestone{adminStats.pendingApprovals !== 1 ? 's' : ''} need your approval to release funds on-chain.
                      </p>
                    </div>
                  </div>
                  <Button asChild>
                    <Link href="/dashboard/admin">
                      Go to approvals
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Quick Stats (non-admin) */}
        {userType !== 'admin' && (
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Deals</CardDescription>
                <CardTitle className="text-3xl">{deals.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Active Deals</CardDescription>
                <CardTitle className="text-3xl">
                  {deals.filter(d => d.status === 'funded' || d.status === 'in_progress').length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Completed Deals</CardDescription>
                <CardTitle className="text-3xl">
                  {deals.filter(d => d.status === 'completed').length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {getQuickActions().map((action) => (
              <Button
                key={action.href}
                asChild
                variant="outline"
                className="h-auto justify-start p-4 bg-transparent"
              >
                <Link href={action.href}>
                  <action.icon className="mr-3 h-5 w-5" />
                  <span className="font-medium">{action.label}</span>
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {/* Recent Deals */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {userType === 'admin' ? 'Recent platform deals' : 'Recent Deals'}
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={userType === 'admin' ? '/marketplace' : '/marketplace'}>
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {deals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No deals yet</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {userType === 'pyme' && 'Create your first deal to get started'}
                  {userType === 'investor' && 'Browse the marketplace to fund your first deal'}
                  {userType === 'supplier' && 'Wait for PyMEs to create deals with you'}
                  {userType === 'admin' && 'No deals on the platform yet'}
                </p>
                {userType === 'pyme' && (
                  <Button asChild>
                    <Link href="/create-deal">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Deal
                    </Link>
                  </Button>
                )}
                {(userType === 'investor' || userType === 'admin') && (
                  <Button asChild>
                    <Link href="/marketplace">Browse Marketplace</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : userType === 'admin' ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left font-medium p-4">Deal</th>
                        <th className="text-left font-medium p-4">Status</th>
                        <th className="text-right font-medium p-4">Amount</th>
                        <th className="text-left font-medium p-4 hidden lg:table-cell">PyME (Buyer)</th>
                        <th className="text-left font-medium p-4 hidden lg:table-cell">Supplier</th>
                        <th className="text-left font-medium p-4 hidden xl:table-cell">Investor</th>
                        <th className="text-left font-medium p-4 hidden xl:table-cell">Funded</th>
                        <th className="text-center font-medium p-4">Milestones</th>
                        <th className="text-right font-medium p-4 w-32">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(deals as DealRow[]).map((deal) => {
                        const pymeName = deal.pyme?.company_name || deal.pyme?.full_name || deal.pyme?.contact_name || '—'
                        const supplierName = deal.supplier?.company_name || deal.supplier?.full_name || deal.supplier?.contact_name || '—'
                        const investorName = deal.investor?.company_name || deal.investor?.full_name || deal.investor?.contact_name || '—'
                        const milestones = deal.milestones ?? []
                        const completed = milestones.filter((m) => m.status === 'completed').length
                        const pending = milestones.filter((m) => m.status === 'in_progress').length
                        const total = milestones.length
                        const statusLabel =
                          deal.status === 'seeking_funding'
                            ? 'Seeking funding'
                            : deal.status === 'funded'
                              ? 'Funded'
                              : deal.status === 'in_progress'
                                ? 'In progress'
                                : deal.status === 'completed'
                                  ? 'Completed'
                                  : deal.status
                        const hasPendingApproval = pending > 0
                        return (
                          <tr key={deal.id} className="border-b border-border last:border-0 hover:bg-muted/20">
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
                                    {deal.term_days} days • {deal.interest_rate ?? '—'}% APR
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge
                                variant={
                                  deal.status === 'completed'
                                    ? 'default'
                                    : deal.status === 'funded' || deal.status === 'in_progress'
                                      ? 'secondary'
                                      : 'outline'
                                }
                              >
                                {statusLabel}
                              </Badge>
                            </td>
                            <td className="p-4 text-right tabular-nums font-medium">
                              ${Number(deal.amount).toLocaleString()}
                            </td>
                            <td className="p-4 hidden lg:table-cell text-muted-foreground" title="PyME (Buyer)">
                              {pymeName}
                            </td>
                            <td className="p-4 hidden lg:table-cell text-muted-foreground">
                              {supplierName}
                            </td>
                            <td className="p-4 hidden xl:table-cell text-muted-foreground">
                              {investorName}
                            </td>
                            <td className="p-4 hidden xl:table-cell text-muted-foreground text-xs">
                              {deal.funded_at ? formatDate(deal.funded_at) : '—'}
                            </td>
                            <td className="p-4 text-center">
                              {total > 0 ? (
                                <span className={hasPendingApproval ? 'text-amber-600 dark:text-amber-400 font-medium' : ''} title={hasPendingApproval ? 'Has milestone(s) awaiting approval' : ''}>
                                  {completed}/{total}
                                  {hasPendingApproval && ' • Pending'}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button asChild variant="ghost" size="sm">
                                  <Link href={`/deals/${deal.id}`}>
                                    View
                                    <ExternalLink className="ml-1 h-3.5 w-3.5 opacity-70" />
                                  </Link>
                                </Button>
                                {hasPendingApproval && (
                                  <Button asChild size="sm">
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
                    Last {deals.length} deals • Created date order
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/marketplace">
                      View all in marketplace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {deals.map((deal) => (
                <Card key={deal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{deal.product_name || deal.title || 'Deal'}</CardTitle>
                        <CardDescription className="mt-1">{deal.description ?? '—'}</CardDescription>
                      </div>
                      <Badge
                        variant={
                          deal.status === 'completed'
                            ? 'default'
                            : deal.status === 'funded' || deal.status === 'in_progress'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {deal.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        ${deal.amount.toLocaleString()} • {deal.term_days} days • {deal.interest_rate}% APR
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/deals/${deal.id}`}>
                          View Details
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
