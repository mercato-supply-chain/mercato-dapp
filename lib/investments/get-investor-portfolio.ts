import type { SupabaseClient } from '@supabase/supabase-js'
import type { InvestorDeal, RwaPortfolioPosition } from './types'
import { buildInvestorPortfolio } from './portfolio-metrics'

const DEAL_COLUMNS = `id, title, product_name, status, amount, contribution_amount, interest_rate, term_days,
   created_at, funded_at, pyme_id, escrow_contract_address,
   pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name)`

const ACTIVE_STATUSES = ['funded', 'in_progress']
const DEFAULT_PAGE_SIZE = 10

export async function getInvestorPortfolio(
  supabase: SupabaseClient,
  userId: string,
  profile: {
    user_type?: string | null
    full_name?: string | null
    company_name?: string | null
    contact_name?: string | null
  } | null,
  labels: { smbFallback: string; dealFallbackTitle: string },
  pagination: { page?: number; pageSize?: number } = {},
) {
  if (profile?.user_type !== 'investor') {
    return null
  }

  const page = Math.max(1, pagination.page ?? 1)
  const pageSize = pagination.pageSize ?? DEFAULT_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const [{ data: summaryRows }, { data: activeDeals }, { data: historyDeals, count: historyTotal }] =
    await Promise.all([
      supabase.rpc('get_investor_portfolio_summary', { p_investor_id: userId }),
      supabase
        .from('deals')
        .select(DEAL_COLUMNS)
        .eq('investor_id', userId)
        .in('status', ACTIVE_STATUSES)
        .order('funded_at', { ascending: false }),
      supabase
        .from('deals')
        .select(DEAL_COLUMNS, { count: 'exact' })
        .eq('investor_id', userId)
        .not('status', 'in', `(${ACTIVE_STATUSES.join(',')})`)
        .order('funded_at', { ascending: false })
        .range(from, to),
    ])

  const summary = summaryRows?.[0]
  if (!summary) {
    return null
  }

  const displayName = profile?.company_name || profile?.full_name || profile?.contact_name || null
  const portfolio = buildInvestorPortfolio({
    activeDeals: (activeDeals ?? []) as InvestorDeal[],
    historyDeals: (historyDeals ?? []) as InvestorDeal[],
    historyTotal: historyTotal ?? 0,
    page,
    pageSize,
    summary,
    displayName,
    smbFallback: labels.smbFallback,
    dealFallbackTitle: labels.dealFallbackTitle,
  })

  const { data: positionRows } = await supabase
    .from('rwa_investor_positions')
    .select('id, credit_asset_id, confirmed_principal_atomic, units_atomic, state, investor_wallet')
    .eq('investor_profile_id', userId)

  const rwaPositions: RwaPortfolioPosition[] = (positionRows ?? []).map((row) => ({
    id: String(row.id),
    creditAssetId: String(row.credit_asset_id),
    principalAtomic: String(row.confirmed_principal_atomic),
    unitsAtomic: String(row.units_atomic),
    settledAtomic: row.state === 'settled' ? String(row.confirmed_principal_atomic) : '0',
    state: String(row.state),
    wallet: String(row.investor_wallet),
  }))

  return { ...portfolio, rwaPositions }
}
