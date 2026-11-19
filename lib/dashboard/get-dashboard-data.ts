import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminApprovalPreview, DashboardDealRow, DashboardPayload } from './types'

/**
 * Thrown when a required dashboard query returns an error. Surfacing this lets
 * the route-level error boundary show a retryable failure instead of rendering
 * misleading zero totals.
 */
export class DashboardQueryError extends Error {
  readonly operation: string
  readonly code: string | null

  constructor(operation: string, cause: { code?: string | null; message?: string | null }) {
    super(`Dashboard query failed: ${operation}`)
    this.name = 'DashboardQueryError'
    this.operation = operation
    this.code = cause.code ?? null
    // Structured, non-sensitive diagnostic: operation name and error code only.
    console.error(
      JSON.stringify({
        event: 'dashboard_query_failed',
        operation,
        code: cause.code ?? null,
      }),
    )
  }
}

/**
 * Unwraps a Supabase-style response. Throws when the response carries an error,
 * so a failed query can never be mistaken for valid zero or empty data.
 */
function unwrap<T>(
  operation: string,
  response: { data: T | null; error: { code?: string | null; message?: string | null } | null },
): T | null {
  if (response.error) {
    throw new DashboardQueryError(operation, response.error)
  }
  return response.data
}

/** Unwraps a count response. Returns a real number or throws on error. */
function unwrapCount(
  operation: string,
  response: { count: number | null; error: { code?: string | null; message?: string | null } | null },
): number {
  if (response.error) {
    throw new DashboardQueryError(operation, response.error)
  }
  return response.count ?? 0
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
    deals = (unwrap('pyme.deals', dealsRes) ?? []) as DashboardDealRow[]
    roleStats = {
      total: unwrapCount('pyme.total', totalRes),
      active: unwrapCount('pyme.active', activeRes),
      completed: unwrapCount('pyme.completed', completedRes),
      seekingFunding: unwrapCount('pyme.seeking', seekingRes),
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
    deals = (unwrap('investor.deals', dealsRes) ?? []) as DashboardDealRow[]
    roleStats = {
      total: unwrapCount('investor.total', totalRes),
      active: unwrapCount('investor.active', activeRes),
      completed: unwrapCount('investor.completed', completedRes),
    }
  } else if (userType === 'supplier') {
    const myCompaniesRes = await supabase
      .from('supplier_companies')
      .select('id, company_name, logo_url')
      .eq('owner_id', userId)
    const myCompanies = unwrap('supplier.companies', myCompaniesRes) ?? []
    supplierCompanies = myCompanies.map((c) => ({
      id: c.id,
      company_name: c.company_name,
      logo_url: (c as { logo_url?: string | null }).logo_url ?? null,
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
      deals = (unwrap('supplier.deals', dealsRes) ?? []) as DashboardDealRow[]
      const total = unwrapCount('supplier.total', totalRes)
      const active = unwrapCount('supplier.active', activeRes)
      const completed = unwrapCount('supplier.completed', completedRes)

      const supplierDealsRes = filterByCompany
        ? await supabase.from('deals').select('id').eq('supplier_id', filterByCompany)
        : await supabase.from('deals').select('id').in('supplier_id', companyIds)
      const supplierDealRows = unwrap('supplier.dealIds', supplierDealsRes) ?? []
      const supplierDealIds = supplierDealRows.map((d) => d.id)
      let pendingDeliveries = 0
      if (supplierDealIds.length > 0) {
        const milestonesRes = await supabase
          .from('milestones')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'in_progress')
          .in('deal_id', supplierDealIds)
        pendingDeliveries = unwrapCount('supplier.pendingDeliveries', milestonesRes)
      }

      roleStats = {
        total,
        active,
        completed,
        pendingDeliveries,
      }

      const companyForCard =
        filterByCompany ?? (supplierCompanies.length === 1 ? supplierCompanies[0].id : null)
      if (companyForCard) {
        const productsRes = await supabase
          .from('supplier_products')
          .select('id, name, category, image_url')
          .eq('supplier_id', companyForCard)
        const productList = unwrap('supplier.products', productsRes) ?? []
        const categories = [
          ...new Set(productList.map((p) => (p as { category: string }).category).filter(Boolean)),
        ]
        const productNames = productList.map((p) => (p as { name: string }).name).filter(Boolean)
        const items = productList.map((p) => {
          const row = p as { id: string; name: string; image_url?: string | null }
          return {
            id: row.id,
            name: row.name,
            image_url: row.image_url ?? null,
          }
        })
        supplierProductsForCard = { categories, products: productNames, items }
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
      fundedRes,
      inProgressRes,
      completedRes,
      recentDealsRes,
      pendingApprovalsRes,
      escrowDealsRes,
      pymeCountRes,
      investorCountRes,
      supplierCountRes,
      supplierCompanyCountRes,
      volumeRowsRes,
      escrowDealRowsRes,
    ] = await Promise.all([
      supabase.from('deals').select('*', { count: 'exact', head: true }),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'seeking_funding'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'funded'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase
        .from('deals')
        .select(
          'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name, logo_url), investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name), milestones(id, status)',
        )
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('milestones').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).not('escrow_contract_address', 'is', null),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'pyme'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'investor'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'supplier'),
      supabase.from('supplier_companies').select('*', { count: 'exact', head: true }),
      supabase.from('deals').select('amount, status').in('status', ['funded', 'in_progress', 'completed']),
      supabase
        .from('deals')
        .select(
          'id, title, amount, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name, logo_url)',
        )
        .not('escrow_contract_address', 'is', null),
    ])

    const totalDeals = unwrapCount('admin.totalDeals', totalDealsRes)
    const seekingFunding = unwrapCount('admin.seekingFunding', seekingFundingRes)
    const fundedCount = unwrapCount('admin.funded', fundedRes)
    const inProgressCount = unwrapCount('admin.inProgress', inProgressRes)
    const completedCount = unwrapCount('admin.completed', completedRes)
    const recentDeals = unwrap('admin.recentDeals', recentDealsRes)
    const pendingApprovals = unwrapCount('admin.pendingApprovals', pendingApprovalsRes)
    const escrowDeals = unwrapCount('admin.escrowDeals', escrowDealsRes)
    const pymeCount = unwrapCount('admin.pymeCount', pymeCountRes)
    const investorCount = unwrapCount('admin.investorCount', investorCountRes)
    const supplierCount = unwrapCount('admin.supplierCount', supplierCountRes)
    const supplierCompanyCount = unwrapCount('admin.supplierCompanyCount', supplierCompanyCountRes)
    const volumeRows = unwrap('admin.volumeRows', volumeRowsRes) ?? []
    const escrowDealRows = unwrap('admin.escrowDealRows', escrowDealRowsRes) ?? []

    const escrowDealIds = escrowDealRows.map((d) => d.id as string)
    let pendingEscrowApprovals = 0
    let releaseQueue = 0

    if (escrowDealIds.length > 0) {
      const [pendingEscrowRes, releaseCountRes, previewMilestonesRes] = await Promise.all([
        supabase
          .from('milestones')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'in_progress')
          .in('deal_id', escrowDealIds),
        supabase
          .from('milestones')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .in('deal_id', escrowDealIds),
        supabase
          .from('milestones')
          .select('id, title, amount, deal_id, created_at')
          .eq('status', 'in_progress')
          .in('deal_id', escrowDealIds)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      pendingEscrowApprovals = unwrapCount('admin.pendingEscrow', pendingEscrowRes)
      releaseQueue = unwrapCount('admin.releaseQueue', releaseCountRes)
      unwrap('admin.previewMilestones', previewMilestonesRes)
    }

    // Remaining admin derivation (volume totals, approval preview, adminStats)
    // continues below; the adjacent section is unchanged by this fix.
    void {
      totalDeals,
      seekingFunding,
      fundedCount,
      inProgressCount,
      completedCount,
      recentDeals,
      pendingApprovals,
      escrowDeals,
      pymeCount,
      investorCount,
      supplierCount,
      supplierCompanyCount,
      volumeRows,
      vaultConfigured,
    }
  }

  return {
    userType,
    fullName,
    companyName,
    deals,
    supplierCompanies,
    supplierProductsForCard,
    adminStats,
    adminApprovalPreview,
    roleStats,
  } as DashboardPayload
}
