import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Upload, ArrowRight } from 'lucide-react'
import { getServerDictionary } from '@/lib/i18n/server'

function tr(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template)
}

export default async function DeliveriesPage() {
  const m = await getServerDictionary()
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

  const { data: myCompanies } = await supabase
    .from('supplier_companies')
    .select('id')
    .eq('owner_id', user.id)
  const companyIds = (myCompanies ?? []).map((c) => c.id)

  const { data: deals } = companyIds.length > 0
    ? await supabase
        .from('deals')
        .select(`
      id,
      title,
      product_name,
      status,
      escrow_contract_address,
      milestones(id, title, status, percentage)
    `)
        .in('supplier_id', companyIds)
        .in('status', ['funded', 'in_progress'])
        .order('created_at', { ascending: false })
    : { data: null }

  const dealsWithPendingMilestones = (deals ?? []).filter((d) => {
    const milestones = (d as { milestones?: { status: string }[] }).milestones ?? []
    return milestones.some((m) => m.status === 'pending' || m.status === 'in_progress')
  })

  const dealStatusLabel = (status: string) => {
    const labels = m.dealStatus as Record<string, string>
    return labels[status] ?? status.replace(/_/g, ' ')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{m.deliveries.title}</h1>
          <p className="text-muted-foreground">{m.deliveries.description}</p>
        </div>

        {dealsWithPendingMilestones.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" aria-hidden />
                {m.deliveries.emptyTitle}
              </CardTitle>
              <CardDescription>{m.deliveries.emptyDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  {m.deliveries.backDashboard}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {dealsWithPendingMilestones.map((deal) => {
              const d = deal as {
                id: string
                title: string
                product_name: string
                status: string
                escrow_contract_address?: string | null
                milestones: { id: string; title: string; status: string; percentage: number }[]
              }
              const pendingCount = d.milestones?.filter(
                (m) => m.status === 'pending' || m.status === 'in_progress'
              ).length ?? 0
              const title = d.product_name || d.title
              return (
                <Card key={d.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{title}</CardTitle>
                        <CardDescription className="mt-1">
                          {pendingCount === 1
                            ? tr(m.deliveries.milestonesPending, { count: pendingCount })
                            : tr(m.deliveries.milestonesPendingPlural, { count: pendingCount })}
                        </CardDescription>
                      </div>
                      <Badge variant={d.status === 'funded' ? 'default' : 'secondary'}>
                        {d.status === 'funded' ? m.deliveries.statusFunded : dealStatusLabel(d.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button asChild size="sm">
                      <Link href={`/deals/${d.id}`}>
                        <Upload className="mr-2 h-4 w-4" aria-hidden />
                        {m.deliveries.openDealUpload}
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
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
