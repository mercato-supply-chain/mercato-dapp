import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

const STATUS_LABELS: Record<string, string> = {
  seeking_funding: 'Open for funding',
  funded: 'Funded',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default async function DashboardDealsPage() {
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

  const { data: deals } = await supabase
    .from('deals')
    .select('id, title, product_name, status, amount, created_at, funded_at')
    .eq('supplier_id', user.id)
    .order('created_at', { ascending: false })

  const list = deals ?? []

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Active deals</h1>
          <p className="text-muted-foreground">
            Deals where you are the supplier. Open a deal to view details or upload delivery proof.
          </p>
        </div>

        {list.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" aria-hidden />
                No deals yet
              </CardTitle>
              <CardDescription>
                Deals where you are selected as the supplier will appear here. PyMEs create deals and choose suppliers from the marketplace.
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
            {list.map((deal) => {
              const title = deal.product_name || deal.title
              const statusLabel = STATUS_LABELS[deal.status] ?? deal.status
              return (
                <Card key={deal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{title}</CardTitle>
                        <CardDescription className="mt-1">
                          Created {deal.created_at ? formatDate(deal.created_at) : '—'}
                          {deal.funded_at && ` · Funded ${formatDate(deal.funded_at)}`}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          deal.status === 'funded' || deal.status === 'in_progress'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium tabular-nums">
                      ${Number(deal.amount).toLocaleString()} USDC
                    </span>
                    <Button asChild size="sm">
                      <Link href={`/deals/${deal.id}`}>
                        View deal
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
