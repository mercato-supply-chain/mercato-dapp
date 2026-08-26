import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getServerDictionary } from '@/lib/i18n/server'
import { getSupplierCommercialActivity } from '@/lib/suppliers/get-supplier-commercial-activity'
import { authorizeSupplierActivityAccess } from '@/lib/suppliers/supplier-activity-authorization'
import {
  parseSupplierActivityParams,
  type SupplierActivityRawParams,
} from '@/lib/suppliers/supplier-activity-params'
import { SUPPLIER_COMMERCIAL_STATES } from '@/lib/suppliers/commercial-states'
import {
  buildActivityTableLabels,
  buildCustomerActivityTableLabels,
  buildFiltersFormLabels,
  buildPaginationLabels,
  buildProductPerformanceTableLabels,
  buildSummaryCardLabels,
  getSupplierActivityStateLabels,
} from '@/lib/suppliers/supplier-activity-labels'
import { SupplierActivitySummaryCards } from '@/components/supplier-activity/summary-cards'
import { SupplierActivityFiltersForm } from '@/components/supplier-activity/filters-form'
import { SupplierActivitySection } from '@/components/supplier-activity/activity-section'
import { SupplierProductPerformanceSection } from '@/components/supplier-activity/product-performance-section'
import { SupplierCustomerActivitySection } from '@/components/supplier-activity/customer-activity-section'

type PageProps = {
  searchParams: Promise<SupplierActivityRawParams>
}

export default async function SupplierActivityPage({ searchParams }: PageProps) {
  const m = await getServerDictionary()
  const rawParams = await searchParams
  const supabase = await createClient()

  const auth = await authorizeSupplierActivityAccess(supabase)
  if (auth.status === 'unauthenticated') redirect('/auth/login')
  if (auth.status === 'unauthorized') redirect('/dashboard')

  const filters = parseSupplierActivityParams(rawParams)

  const data = await getSupplierCommercialActivity(supabase, auth.userId, {
    companyId: filters.companyId,
    productId: filters.productId,
    category: filters.category,
    commercialStatus: filters.commercialStatus,
    dateFrom: filters.dateFromISO,
    dateTo: filters.dateToISO,
    page: filters.page,
    pageSize: 20,
  })

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">{m.supplierActivity.loadError}</p>
      </div>
    )
  }

  const stateLabels = getSupplierActivityStateLabels(m.supplierActivity)
  const categories = Array.from(
    new Set(data.filterProducts.map((p) => p.category).filter(Boolean)),
  ).sort()

  const filterQuery = {
    company: filters.companyId,
    product: filters.productId,
    category: filters.category,
    status: filters.commercialStatus,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
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
        labels={buildSummaryCardLabels(m.supplierActivity)}
      />

      <SupplierActivityFiltersForm
        companies={data.companies}
        products={data.filterProducts}
        categories={categories}
        commercialStates={SUPPLIER_COMMERCIAL_STATES}
        stateLabels={stateLabels}
        labels={buildFiltersFormLabels(m.supplierActivity)}
        values={{
          companyId: filters.companyId,
          productId: filters.productId,
          category: filters.category,
          commercialStatus: filters.commercialStatus,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        }}
      />

      <SupplierActivitySection
        sectionTitle={m.supplierActivity.activityTitle}
        items={data.activity}
        stateLabels={stateLabels}
        tableLabels={buildActivityTableLabels(m.supplierActivity)}
        page={filters.page}
        totalPages={totalPages}
        filterQuery={filterQuery}
        paginationLabels={buildPaginationLabels(m.supplierActivity)}
      />

      <SupplierProductPerformanceSection
        sectionTitle={m.supplierActivity.productPerformanceTitle}
        items={data.productPerformance}
        labels={buildProductPerformanceTableLabels(m.supplierActivity)}
      />

      <SupplierCustomerActivitySection
        sectionTitle={m.supplierActivity.customerActivityTitle}
        items={data.customerActivity}
        labels={buildCustomerActivityTableLabels(m.supplierActivity)}
      />
    </div>
  )
}
