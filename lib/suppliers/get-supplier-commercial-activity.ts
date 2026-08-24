import type { SupabaseClient } from '@supabase/supabase-js'
import type { SupplierCommercialState } from '@/lib/suppliers/commercial-states'

export type SupplierCommercialFilters = {
  companyId?: string | null
  productId?: string | null
  category?: string | null
  commercialStatus?: SupplierCommercialState | null
  dateFrom?: string | null
  dateTo?: string | null
  page?: number
  pageSize?: number
}

export type SupplierCommercialSummary = {
  openFinancingRequests: number
  activeFinancedSales: number
  completedFinancedSales: number
  pendingShipments: number
  totalFinancedVolume: number
}

export type SupplierCommercialActivityItem = {
  dealId: string
  productId: string | null
  productName: string
  productQuantity: number
  productUnitPrice: number
  amount: number
  category: string
  commercialState: SupplierCommercialState
  supplierCompanyId: string
  supplierCompanyName: string
  pymeId: string
  pymeName: string
  investorId: string | null
  investorName: string | null
  createdAt: string
  fundedAt: string | null
  shippedAt: string | null
}

export type SupplierProductPerformance = {
  productId: string
  productName: string
  category: string
  financingRequestCount: number
  fundedRequestCount: number
  financingConversionRate: number
  financedVolume: number
  completedVolume: number
}

export type SupplierCustomerActivity = {
  pymeId: string
  pymeName: string
  productsRequested: string[]
  financingRequestCount: number
  financingRequestValue: number
  fundedRequestCount: number
  awaitingFundingCount: number
  mostRecentActivityAt: string | null
}

export type SupplierCommercialActivityPayload = {
  summary: SupplierCommercialSummary
  activity: SupplierCommercialActivityItem[]
  activityTotal: number
  productPerformance: SupplierProductPerformance[]
  customerActivity: SupplierCustomerActivity[]
  page: number
  pageSize: number
  companies: Array<{ id: string; companyName: string }>
  filterProducts: Array<{ id: string; name: string; category: string }>
}

const DEFAULT_PAGE_SIZE = 20

function toRpcFilters(ownerId: string, filters: SupplierCommercialFilters) {
  return {
    p_owner_id: ownerId,
    p_company_id: filters.companyId ?? null,
    p_product_id: filters.productId ?? null,
    p_category: filters.category ?? null,
    p_commercial_status: filters.commercialStatus ?? null,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
  }
}

export function mapProductConversionRate(funded: number, eligible: number): number {
  if (eligible <= 0) return 0
  return Math.round((funded / eligible) * 10000) / 10000
}

export async function getSupplierCommercialActivity(
  supabase: SupabaseClient,
  ownerId: string,
  filters: SupplierCommercialFilters = {},
): Promise<SupplierCommercialActivityPayload | null> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE))
  const rpcFilters = toRpcFilters(ownerId, filters)

  const [{ data: companies }, summaryResult, activityResult, performanceResult, customerResult] =
    await Promise.all([
      supabase
        .from('supplier_companies')
        .select('id, company_name')
        .eq('owner_id', ownerId)
        .order('company_name'),
      supabase.rpc('get_supplier_commercial_summary', rpcFilters),
      supabase.rpc('get_supplier_commercial_activity', {
        ...rpcFilters,
        p_page: page,
        p_page_size: pageSize,
      }),
      supabase.rpc('get_supplier_product_performance', rpcFilters),
      supabase.rpc('get_supplier_customer_activity', rpcFilters),
    ])

  const companyIds = (companies ?? []).map((c) => c.id)
  const { data: products } =
    companyIds.length > 0
      ? await supabase
          .from('supplier_products')
          .select('id, name, category')
          .in('supplier_id', companyIds)
          .order('name')
      : { data: [] }

  const summaryRow = summaryResult.data?.[0]
  if (!summaryRow) {
    return null
  }

  const activityRows = activityResult.data ?? []
  const activityTotal = activityRows.length > 0 ? Number(activityRows[0].total_count ?? 0) : 0

  return {
    summary: {
      openFinancingRequests: Number(summaryRow.open_financing_requests ?? 0),
      activeFinancedSales: Number(summaryRow.active_financed_sales ?? 0),
      completedFinancedSales: Number(summaryRow.completed_financed_sales ?? 0),
      pendingShipments: Number(summaryRow.pending_shipments ?? 0),
      totalFinancedVolume: Number(summaryRow.total_financed_volume ?? 0),
    },
    activity: activityRows.map((row) => ({
      dealId: row.deal_id,
      productId: row.product_id ?? null,
      productName: row.product_name,
      productQuantity: Number(row.product_quantity),
      productUnitPrice: Number(row.product_unit_price),
      amount: Number(row.amount),
      category: row.category,
      commercialState: row.commercial_state as SupplierCommercialState,
      supplierCompanyId: row.supplier_company_id,
      supplierCompanyName: row.supplier_company_name,
      pymeId: row.pyme_id,
      pymeName: row.pyme_name,
      investorId: row.investor_id ?? null,
      investorName: row.investor_name?.trim() ? row.investor_name : null,
      createdAt: row.created_at,
      fundedAt: row.funded_at ?? null,
      shippedAt: row.shipped_at ?? null,
    })),
    activityTotal,
    productPerformance: (performanceResult.data ?? []).map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      category: row.category,
      financingRequestCount: Number(row.financing_request_count ?? 0),
      fundedRequestCount: Number(row.funded_request_count ?? 0),
      financingConversionRate: Number(row.financing_conversion_rate ?? 0),
      financedVolume: Number(row.financed_volume ?? 0),
      completedVolume: Number(row.completed_volume ?? 0),
    })),
    customerActivity: (customerResult.data ?? []).map((row) => ({
      pymeId: row.pyme_id,
      pymeName: row.pyme_name,
      productsRequested: row.products_requested ?? [],
      financingRequestCount: Number(row.financing_request_count ?? 0),
      financingRequestValue: Number(row.financing_request_value ?? 0),
      fundedRequestCount: Number(row.funded_request_count ?? 0),
      awaitingFundingCount: Number(row.awaiting_funding_count ?? 0),
      mostRecentActivityAt: row.most_recent_activity_at ?? null,
    })),
    page,
    pageSize,
    companies: (companies ?? []).map((c) => ({
      id: c.id,
      companyName: c.company_name || 'Company',
    })),
    filterProducts: (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
    })),
  }
}
