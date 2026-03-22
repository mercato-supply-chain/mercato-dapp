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
  ArrowRight,
  TrendingUp,
  Globe,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
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

const DEAL_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  seeking_funding: { label: 'Open for funding', className: 'bg-accent/10 text-accent' },
  funded: { label: 'Funded', className: 'bg-success/10 text-success' },
  in_progress: { label: 'In progress', className: 'bg-primary/10 text-primary' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: company, error: companyError } = await supabase
    .from('supplier_companies')
    .select(
      'id, owner_id, company_name, bio, full_name, contact_name, phone, address, categories, products, verified, country, sector'
    )
    .eq('id', id)
    .single()

  if (companyError || !company) notFound()

  const [{ data: ownerProfile }, { data: products }, { count: dealsCount }, { data: recentDeals }] =
    await Promise.all([
      supabase.from('profiles').select('email').eq('id', company.owner_id).single(),
      supabase
        .from('supplier_products')
        .select('id, name, category, price_per_unit, description, minimum_order, delivery_time')
        .eq('supplier_id', id)
        .order('name'),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('supplier_id', id),
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
  const profile = { ...company, email: ownerProfile?.email ?? null }
  const displayName = company.company_name || company.full_name || company.contact_name || 'Supplier'

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/suppliers" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Suppliers
          </Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-40" aria-hidden />
          <span className="truncate text-foreground/70">{displayName}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" aria-hidden />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {profile.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success ring-1 ring-success/20">
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      Verified
                    </span>
                  )}
                  {profile.sector && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5" aria-hidden />
                      {getSectorLabel(profile.sector)}
                    </span>
                  )}
                  {profile.country && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" aria-hidden />
                      {getCountryLabel(profile.country)}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-bold">{displayName}</h1>
              </div>
            </div>

            <Button asChild>
              <Link href={`/create-deal?supplierId=${id}`}>
                Create deal
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          {profile.bio && (
            <p className="mt-4 max-w-2xl text-muted-foreground">{profile.bio}</p>
          )}
        </div>

        {/* Stat row */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Products
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{productList.length}</p>
            <p className="text-[11px] text-muted-foreground">in catalog</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Deals
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{totalDeals}</p>
            <p className="text-[11px] text-muted-foreground">on MERCATO</p>
          </div>
          <div className="col-span-2 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:col-span-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Categories
            </p>
            {profile.categories?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {profile.categories.slice(0, 4).map((cat: string) => (
                  <Badge key={cat} variant="secondary" className="text-xs capitalize">
                    {cat}
                  </Badge>
                ))}
                {profile.categories.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{profile.categories.length - 4}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No categories</p>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Products catalog — takes 2 cols */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 shrink-0" aria-hidden />
                  Products &amp; prices
                </CardTitle>
                <CardDescription>
                  Catalog of products offered with unit prices and ordering details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {productList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="text-sm text-muted-foreground">No products in catalog yet</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {productList.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{p.name}</p>
                            <Badge variant="outline" className="text-xs capitalize">
                              {p.category}
                            </Badge>
                          </div>
                          {p.description && (
                            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                              {p.description}
                            </p>
                          )}
                          {(p.minimum_order != null || p.delivery_time) && (
                            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {p.minimum_order != null && (
                                <span className="flex items-center gap-1 tabular-nums">
                                  <DollarSign className="h-3 w-3" aria-hidden />
                                  Min. {formatPrice(p.minimum_order)}
                                </span>
                              )}
                              {p.delivery_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" aria-hidden />
                                  {p.delivery_time}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold tabular-nums">{formatPrice(p.price_per_unit)}</p>
                          <p className="text-xs text-muted-foreground">per unit</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Contact */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <a href={`mailto:${profile.email}`} className="truncate text-accent hover:underline">
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
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span className="font-mono text-xs break-all">{profile.address}</span>
                  </div>
                )}
                {!profile.email && !profile.phone && !profile.address && (
                  <p className="text-sm text-muted-foreground">No contact details available</p>
                )}
              </CardContent>
            </Card>

            {/* Recent deals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" aria-hidden />
                  Recent deals
                </CardTitle>
                <CardDescription>Deals where this supplier is involved</CardDescription>
              </CardHeader>
              <CardContent>
                {dealsList.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No deals yet</p>
                ) : (
                  <div className="space-y-2">
                    {dealsList.map((d) => {
                      const cfg = DEAL_STATUS_CONFIG[d.status] ?? {
                        label: d.status,
                        className: 'bg-muted text-muted-foreground',
                      }
                      return (
                        <Link
                          key={d.id}
                          href={`/deals/${d.id}`}
                          className="group flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-accent">
                            {d.product_name || d.title || 'Deal'}
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="tabular-nums text-xs text-muted-foreground">
                              ${Number(d.amount).toLocaleString()}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}
                            >
                              {cfg.label}
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                    {totalDeals > 5 && (
                      <p className="pt-1 text-center text-xs text-muted-foreground">
                        +{totalDeals - 5} more deal{totalDeals - 5 !== 1 ? 's' : ''} on platform
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
