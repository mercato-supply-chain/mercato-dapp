import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminApprovalPreview, DashboardDealRow, DashboardPayload } from './types'

export class DashboardQueryError extends Error {
  readonly operation: string
  readonly code?: string

  constructor(operation: string, cause: { message?: string; code?: string } | null) {
    super(`Dashboard query failed: ${operation}${cause?.message ? ` (${cause.message})` : ''}`)
    this.name = 'DashboardQueryError'
    this.operation = operation
    this.code = cause?.code
  }
}

export function isDashboardDataError(error: unknown): error is DashboardQueryError {
  return error instanceof DashboardQueryError
}

type QueryResponse<T> = { data: T | null; error: { message?: string; code?: string } | null; count?: number | null }

export function requireQuery<T>(operation: string, response: QueryResponse<T>): QueryResponse<T> {
  if (response.error) throw new DashboardQueryError(operation, response.error)
  return response
}

export function optionalQuery<T>(
  operation: string,
  response: QueryResponse<T>,
): { ok: true; response: QueryResponse<T> } | { ok: false; operation: string } {
  if (response.error) return { ok: false, operation }
  return { ok: true, response }
}

export async function getDashboardData(
  supabase: SupabaseClient,
  userId: string,
  profile: {
    full_name?: string | null
    contact_name?: string | null
    company_name?: string | null
    user_type?: string | null
  } | null,
  userEmail: string | undefined,
  companyFilterId: string | null,
): Promise<DashboardPayload> {
  const userType = profile?.user_type || 'pyme'
  const fullName = profile?.full_name || profile?.contact_name || userEmail || ''
  const companyName = profile?.company_name

  let deals: DashboardDealRow[] = []
  let supplierCompanies: {
    id: string
    company_name: string | null
    logo_url: string | null
  }[] = []
  let supplierProductsForCard: DashboardPayload['supplierProductsForCard'] = null
  let adminStats: DashboardPayload['adminStats'] = null
  let adminApprovalPreview: AdminApprovalPreview[] = []
  let roleStats: DashboardPayload['roleStats'] = null
  const unavailableSections: string[] = []

  if (userType === 'pyme') {
    const [dealsRes, totalRes, activeRes, completedRes, seekingRes] = await Promise.all([
      supabase
        .from('deals')
        .select(
          'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, milestones(id, status)',
        )
        .eq('pyme_id', userId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('pyme_id', userId),
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('pyme_id', userId)
        .in('status', ['funded', 'in_progress']),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('pyme_id', userId).eq('status', 'completed'),
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('pyme_id', userId)
        .eq('status', 'seeking_funding'),
    ])
    const dealsResponse = requireQuery('pyme.deals', dealsRes as QueryResponse<DashboardDealRow[]>)
    const totalResponse = requireQuery('pyme.deals.total', totalRes as QueryResponse<unknown>)
    const activeResponse = requireQuery('pyme.deals.active', activeRes as QueryResponse<unknown>)
    const completedResponse = requireQuery('pyme.deals.completed', completedRes as QueryResponse<unknown>)
    const seekingResponse = requireQuery('pyme.deals.seekingFunding', seekingRes as QueryResponse<unknown>)
    deals = (dealsResponse.data || []) as DashboardDealRow[]
    roleStats = {
      total: totalResponse.count ?? 0,
      active: activeResponse.count ?? 0,
      completed: completedResponse.count ?? 0,
      seekingFunding: seekingResponse.count ?? 0,
    }
  } else if (userType === 'investor') {
    const [dealsRes, totalRes, activeRes, completedRes] = await Promise.all([
      supabase
        .from('deals')
        .select(
          'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), milestones(id, status)',
        )
        .eq('investor_id', userId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('investor_id', userId),
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('investor_id', userId)
        .in('status', ['funded', 'in_progress']),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('investor_id', userId).eq('status', 'completed'),
    ])
    const dealsResponse = requireQuery('investor.deals', dealsRes as QueryResponse<DashboardDealRow[]>)
    const totalResponse = requireQuery('investor.deals.total', totalRes as QueryResponse<unknown>)
    const activeResponse = requireQuery('investor.deals.active', activeRes as QueryResponse<unknown>)
    const completedResponse = requireQuery('investor.deals.completed', completedRes as QueryResponse<unknown>)
    deals = (dealsResponse.data || []) as DashboardDealRow[]
    roleStats = {
      total: totalResponse.count ?? 0,
      active: activeResponse.count ?? 0,
      completed: completedResponse.count ?? 0,
    }
  } else if (userType === 'supplier') {
    const myCompaniesRes = await supabase
      .from('supplier_companies')
      .select('id, company_name, logo_url')
      .eq('owner_id', userId)
    const myCompaniesResponse = requireQuery('supplier.companies', myCompaniesRes as QueryResponse<{ company_name: string | null; id: string; logo_url?: string | null }[]>)
    supplierCompanies = (myCompaniesResponse.data ?? []).map((c) => ({
      id: c.id,
      company_name: c.company_name,
      logo_url: c.logo_url ?? null,
    }))
    const companyIds = supplierCompanies.map((c) => c.id)

    if (companyIds.length > 0) {
      const filterByCompany =
        companyFilterId && companyIds.includes(companyFilterId) ? companyFilterId : null
      const dealsBase = filterByCompany
        ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
        : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)

      const [dealsRes, totalRes, activeRes, completedRes] = await Promise.all([
        (filterByCompany
          ? supabase
              .from('deals')
              .select(
                'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name, logo_url), milestones(id, status)',
              )
              .eq('supplier_id', filterByCompany)
          : supabase
              .from('deals')
              .select(
                'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name, logo_url), milestones(id, status)',
              )
              .in('supplier_id', companyIds)
        )
          .order('created_at', { ascending: false })
          .limit(10),
        dealsBase,
        (filterByCompany
          ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
          : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)
        ).in('status', ['funded', 'in_progress']),
        (filterByCompany
          ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
          : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)
        ).eq('status', 'completed'),
      ])
      const dealsResponse = requireQuery('supplier.deals', dealsRes as QueryResponse<DashboardDealRow[]>)
      const totalResponse = requireQuery('supplier.deals.total', totalRes as QueryResponse<unknown>)
      const activeResponse = requireQuery('supplier.deals.active', activeRes as QueryResponse<unknown>)
      const completedResponse = requireQuery('supplier.deals.completed', completedRes as QueryResponse<unknown>)
      deals = (dealsResponse.data || []) as DashboardDealRow[]

      const supplierDealRes = filterByCompany
        ? await supabase.from('deals').select('id').eq('supplier_id', filterByCompany)
        : await supabase.from('deals').select('id').in('supplier_id', companyIds)
      const supplierDealResponse = requireQuery('supplier.deals.ids', supplierDealRes as QueryResponse<{ id: string }[]>)
      const supplierDealids = (supplierDealResponse.data ?? []).map((d) => d.id)
      let pendingDeliveries = 0
      if (supplierDealids.length > 0) {
        const pendingResponse = requireQuery(
          'supplier.milestones.pending',
          (await supabase
            .from('milestones')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'in_progress')
            .in('deal_id', supplierDealids)) as QueryResponse<unknown>,
        )
        pendingDeliveries = pendingResponse.count ?? 0
      }

      roleStats = {
        total: totalResponse.count ?? 0,
        active: activeResponse.count ?? 0,
        completed: completedResponse.count ?? 0,
        pendingDeliveries,
      }

      const companyForCard =
        filterByCompany ?? (supplierCompanies.length === 1 ? supplierCompanies[0].id : null)
      if (companyForCard) {
        const productsRes = await supabase
          .from('supplier_products')
          .select('id, name, category, image_url')
          .eq('supplier_id', companyForCard)
        const productsResponse = optionalQuery(
          'supplier.products',
          productsRes as QueryResponse<{ category: string; id: string; image_url?: string | null; name: string }[]>,
        )
        if (!productsResponse.ok) {
          unavailableSections.push(productsResponse.operation)
        } else {
          const productList = productsResponse.response.data ?? []
          const categories = [
            ...new Set(productList.map((p) => p.category).filter(Boolean)),
          ]
          const productNames = productList.map((p) => p.name).filter(Boolean)
          const items = productList.map((p) => ({
            id: p.id,
            name: p.name,
            image_url: p.image_url ?? null,
          }))
          supplierProductsForCard = { categories, products: productNames, items }
        }
      }
    }
  } else if (userType === 'admin') {
    const vaultConfigured = Boolean(
      process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim() ||
        process.env.NEXT_PUBLIC_MERCATO_DEFINDEX_VAULT_ADDRESS?.trim() ||
        process.env.MERCATO_DEFINDEX_VAULT_ADDRESS?.trim(),
    )

    const [
      totalDealsRes,
      seekingFundingRes,
      fundedCountRes,
      inProgressCountRes,
      completedCountRes,
      recentDealsRes,
      pendingApprovalsRes,
      escrowDealsRes,
      pymeCountRes,
      investorCountRes,
      supplierCountRes,
      supplierCompanyCountRes,
      volumeRowsRes,
    ] = await Promise.all([
      supabase.from('deals').select('*', { count: 'exact', head: true }),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'seeking_funding'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'funded'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
