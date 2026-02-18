import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Package,
  ArrowLeft,
  FileText,
  TrendingUp,
  Globe,
  Briefcase,
} from 'lucide-react'
import { getCountryLabel, getSectorLabel } from '@/lib/constants'

type ProductRow = {
  id: string
  name: string
  category: string
  price_per_unit: number
  description: string | null
  minimum_order: number | null
  delivery_time: string | null
}

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

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, company_name, bio, full_name, contact_name, email, phone, address, categories, products, verified, user_type, country, sector')
    .eq('id', id)
    .single()

  if (profileError || !profile || profile.user_type !== 'supplier') {
    notFound()
  }

  const [{ data: products }, { count: dealsCount }, { data: recentDeals }] = await Promise.all([
    supabase
      .from('supplier_products')
      .select('id, name, category, price_per_unit, description, minimum_order, delivery_time')
      .eq('supplier_id', id)
      .order('name'),
    supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id),
    supabase
      .from('deals')
      .select('id, title, product_name, status, amount, created_at')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const productList = (products ?? []) as ProductRow[]
  const dealsList = (recentDeals ?? []) as DealRow[]
  const totalDeals = dealsCount ?? 0

  const displayName = profile.company_name || profile.full_name || profile.contact_name || 'Supplier'

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/suppliers">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to suppliers
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" aria-hidden />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{displayName}</h1>
                {profile.verified && (
                  <Badge variant="secondary" className="mt-2 bg-success/10 text-success">
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

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Products in catalog</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{productList.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total deals on MERCATO</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{totalDeals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Categories</CardDescription>
              <CardTitle className="text-xl">
                {profile.categories?.length ? profile.categories.length : 0}
              </CardTitle>
              {profile.categories && profile.categories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {profile.categories.slice(0, 5).map((cat) => (
                    <Badge key={cat} variant="secondary" className="text-xs capitalize">
                      {cat}
                    </Badge>
                  ))}
                  {profile.categories.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{profile.categories.length - 5}
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-balance">
                <Package className="h-5 w-5 shrink-0" aria-hidden />
                Products &amp; prices
              </CardTitle>
              <CardDescription>
                Catalog of products this supplier offers with prices per unit
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productList.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No products in catalog yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {productList.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50 min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{p.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="shrink-0 text-xs font-medium capitalize">
                            {p.category}
                          </Badge>
                          {p.description ? (
                            <span className="line-clamp-1 min-w-0 break-words">{p.description}</span>
                          ) : null}
                        </div>
                        {(p.minimum_order != null || p.delivery_time) && (
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {p.minimum_order != null && (
                              <span className="tabular-nums">
                                Min. order: {formatPrice(p.minimum_order)}
                              </span>
                            )}
                            {p.delivery_time && (
                              <span>Delivery: {p.delivery_time}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="shrink-0 text-right font-semibold tabular-nums text-foreground">
                        {formatPrice(p.price_per_unit)}
                        <span className="ml-0.5 text-sm font-normal text-muted-foreground">/unit</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Contact & profile */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" aria-hidden />
                  Contact & details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <a href={`mailto:${profile.email}`} className="text-accent hover:underline">
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
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="font-mono text-xs">{profile.address}</span>
                  </div>
                )}
                {profile.products && profile.products.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Product list (summary)</p>
                    <p className="text-sm">{profile.products.join(', ')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent deals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" aria-hidden />
                  Recent deals
                </CardTitle>
                <CardDescription>
                  Deals where this supplier is selected
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dealsList.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No deals yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dealsList.map((d) => (
                      <Link
                        key={d.id}
                        href={`/deals/${d.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="font-medium">
                          {d.product_name || d.title || 'Deal'}
                        </span>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="tabular-nums">${Number(d.amount).toLocaleString()}</span>
                          <Badge variant="secondary" className="text-xs">
                            {STATUS_LABELS[d.status] ?? d.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                    {totalDeals > 5 && (
                      <p className="pt-2 text-center text-xs text-muted-foreground">
                        {totalDeals - 5} more deal{totalDeals - 5 !== 1 ? 's' : ''} on platform
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8">
          <Button asChild>
            <Link href="/create-deal">
              Create deal with this supplier
              <ArrowLeft className="ml-2 h-4 w-4 rotate-180" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
