import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Upload, ArrowRight } from 'lucide-react'

export default async function DeliveriesPage() {
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

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Delivery proof</h1>
          <p className="text-muted-foreground">
            Deals where you are the supplier. Upload proof of shipment or delivery from each deal page.
          </p>
        </div>

        {dealsWithPendingMilestones.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" aria-hidden />
                No deliveries to action
              </CardTitle>
              <CardDescription>
                You don’t have any funded deals with pending milestones. When a deal you supply is funded, it will appear here so you can upload proof of shipment or delivery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  Back to dashboard
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
                          {pendingCount} milestone{pendingCount !== 1 ? 's' : ''} awaiting proof or approval
                        </CardDescription>
                      </div>
                      <Badge variant={d.status === 'funded' ? 'default' : 'secondary'}>
                        {d.status === 'funded' ? 'Funded' : d.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button asChild size="sm">
                      <Link href={`/deals/${d.id}`}>
                        <Upload className="mr-2 h-4 w-4" aria-hidden />
                        Open deal & upload proof
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
