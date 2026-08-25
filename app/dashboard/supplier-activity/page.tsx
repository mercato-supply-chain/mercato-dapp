import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerDictionary } from '@/lib/i18n/server'
import { getSupplierCommercialActivity } from '@/lib/suppliers/get-supplier-commercial-activity'
import type { SupplierCommercialState } from '@/lib/suppliers/commercial-states'
import { SupplierActivitySummaryCards } from '@/components/supplier-activity/summary-cards'
import { SupplierActivityFiltersForm } from '@/components/supplier-activity/filters-form'
import { SupplierActivityTable } from '@/components/supplier-activity/activity-table'
import { ProductPerformanceTable } from '@/components/supplier-activity/product-performance-table'
import { CustomerActivityTable } from '@/components/supplier-activity/customer-activity-table'
import { Button } from '@/components/ui/button'

const COMMERCIAL_STATES: SupplierCommercialState[] = [
  'financing_request',
  'expired',
  'cancelled',
  'financed_sale',
  'needs_shipment',
  'in_fulfillment',
  'completed_sale',
]

type PageProps = {
  searchParams: Promise<{
    company?: string
    product?: string
    category?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    page?: string
  }>
}

function buildPageHref(
  base: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(base)) {
    if (value) params.set(key, value)
  }
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/dashboard/supplier-activity?${qs}` : '/dashboard/supplier-activity'
}

export default async function SupplierActivityPage({ searchParams }: PageProps) {
  const m = await getServerDictionary()
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'supplier') {
    redirect('/dashboard')
  }

  const companyId = params.company?.trim() || undefined
  const productId = params.product?.trim() || undefined
  const category = params.category?.trim() || undefined
  const commercialStatus = COMMERCIAL_STATES.includes(params.status as SupplierCommercialState)
    ? (params.status as SupplierCommercialState)
    : undefined
  const dateFrom = params.dateFrom
    ? new Date(`${params.dateFrom}T00:00:00.000Z`).toISOString()
    : undefined
  const dateTo = params.dateTo
    ? new Date(`${params.dateTo}T23:59:59.999Z`).toISOString()
    : undefined
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)

  const data = await getSupplierCommercialActivity(supabase, user.id, {
    companyId,
    productId,
    category,
    commercialStatus,
    dateFrom,
    dateTo,
    page,
    pageSize: 20,
  })

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">{m.supplierActivity.loadError}</p>
      </div>
    )
  }

  const stateLabels = m.supplierActivity.states as Record<SupplierCommercialState, string>
  const categories = Array.from(
    new Set(data.filterProducts.map((p) => p.category).filter(Boolean)),
  ).sort()

  const filterBase = {
    company: companyId,
    product: productId,
    category,
    status: commercialStatus,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  }

  const totalPages = Math.max(1, Math.ceil(data.activityTotal / data.pageSize))

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">{m.supplierActivity.title}</h1>
        <p className="text-muted-foreground">{m.supplierActivity.description}</p>
      </div>

      <SupplierActivitySummaryCards
        summary={data.summary}
        labels={{
          openRequests: m.supplierActivity.summary.openRequests,
          activeFinanced: m.supplierActivity.summary.activeFinanced,
          completedFinanced: m.supplierActivity.summary.completedFinanced,
          pendingShipments: m.supplierActivity.summary.pendingShipments,
          totalVolume: m.supplierActivity.summary.totalVolume,
        }}
      />

      <SupplierActivityFiltersForm
        companies={data.companies}
        products={data.filterProducts}
        categories={categories}
        commercialStates={COMMERCIAL_STATES}
        stateLabels={stateLabels}
        labels={{
          company: m.supplierActivity.filters.company,
          product: m.supplierActivity.filters.product,
          category: m.supplierActivity.filters.category,
          status: m.supplierActivity.filters.status,
          dateFrom: m.supplierActivity.filters.dateFrom,
          dateTo: m.supplierActivity.filters.dateTo,
          all: m.supplierActivity.filters.all,
          apply: m.supplierActivity.filters.apply,
          clear: m.supplierActivity.filters.clear,
        }}
        values={{
          companyId,
          productId,
          category,
          commercialStatus,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }}
      />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{m.supplierActivity.activityTitle}</h2>
        <SupplierActivityTable
          items={data.activity}
          stateLabels={stateLabels}
          labels={{
            title: m.supplierActivity.activityTitle,
            product: m.supplierActivity.table.product,
            customer: m.supplierActivity.table.customer,
            company: m.supplierActivity.table.company,
            amount: m.supplierActivity.table.amount,
            quantity: m.supplierActivity.table.quantity,
            unitPrice: m.supplierActivity.table.unitPrice,
            status: m.supplierActivity.table.status,
            investor: m.supplierActivity.table.investor,
            created: m.supplierActivity.table.created,
            funded: m.supplierActivity.table.funded,
            shipped: m.supplierActivity.table.shipped,
            viewDeal: m.supplierActivity.table.viewDeal,
            empty: m.supplierActivity.activityEmpty,
          }}
        />
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {m.supplierActivity.pagination
                .replace('{page}', String(page))
                .replace('{total}', String(totalPages))}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildPageHref(filterBase, page - 1)}>
                    {m.supplierActivity.prevPage}
                  </Link>
                </Button>
              )}
              {page < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={buildPageHref(filterBase, page + 1)}>
                    {m.supplierActivity.nextPage}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{m.supplierActivity.productPerformanceTitle}</h2>
        <ProductPerformanceTable
          items={data.productPerformance}
          labels={{
            title: m.supplierActivity.productPerformanceTitle,
            product: m.supplierActivity.table.product,
            category: m.supplierActivity.table.category,
            requests: m.supplierActivity.productPerformance.requests,
            funded: m.supplierActivity.productPerformance.funded,
            conversion: m.supplierActivity.productPerformance.conversion,
            financedVolume: m.supplierActivity.productPerformance.financedVolume,
            completedVolume: m.supplierActivity.productPerformance.completedVolume,
            empty: m.supplierActivity.productPerformanceEmpty,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{m.supplierActivity.customerActivityTitle}</h2>
        <CustomerActivityTable
          items={data.customerActivity}
          labels={{
            title: m.supplierActivity.customerActivityTitle,
            customer: m.supplierActivity.table.customer,
            products: m.supplierActivity.customerActivity.products,
            requests: m.supplierActivity.customerActivity.requests,
            requestValue: m.supplierActivity.customerActivity.requestValue,
            funded: m.supplierActivity.customerActivity.funded,
            awaiting: m.supplierActivity.customerActivity.awaiting,
            lastActivity: m.supplierActivity.customerActivity.lastActivity,
            empty: m.supplierActivity.customerActivityEmpty,
          }}
        />
      </section>
    </div>
  )
}
