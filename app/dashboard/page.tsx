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
  CheckCircle2
} from 'lucide-react'

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
  const fullName = profile?.full_name || user.email
  const companyName = profile?.company_name

  // Get user's deals based on their role
  let deals = []
  if (userType === 'pyme') {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('pyme_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    deals = data || []
  } else if (userType === 'investor') {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('investor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    deals = data || []
  } else if (userType === 'supplier') {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    deals = data || []
  }

  const getRoleIcon = () => {
    switch (userType) {
      case 'pyme':
        return <Package className="h-5 w-5" />
      case 'investor':
        return <TrendingUp className="h-5 w-5" />
      case 'supplier':
        return <Users className="h-5 w-5" />
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
          { label: 'View Active Deals', href: '/dashboard/deals', icon: Package },
          { label: 'Upload Delivery Proof', href: '/dashboard/deliveries', icon: CheckCircle2 },
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

        {/* Quick Stats */}
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
            <h2 className="text-xl font-semibold">Recent Deals</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/marketplace">
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
                </p>
                {userType === 'pyme' && (
                  <Button asChild>
                    <Link href="/create-deal">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Deal
                    </Link>
                  </Button>
                )}
                {userType === 'investor' && (
                  <Button asChild>
                    <Link href="/marketplace">Browse Marketplace</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {deals.map((deal) => (
                <Card key={deal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{deal.title}</CardTitle>
                        <CardDescription className="mt-1">{deal.description}</CardDescription>
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
                        ${deal.amount.toLocaleString()} • {deal.term_days} days • {deal.apr}% APR
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
