import type { SupabaseClient } from '@supabase/supabase-js'
import type { PymeReputationStats } from '@/lib/pyme-reputation'

/**
 * Deal data for the public investor / PyME profile pages.
 *
 * Profile pages only ever render a short list of recent deals, but the headline
 * numbers (totals, active/completed counts, repaid volume, reputation inputs) are
 * computed over the account's full history. The history stays in Postgres: the
 * recent list is capped with `limit`, and the aggregates come from a single-row
 * RPC so neither the response size nor the server-side work grows with it.
 *
 * Requires supabase/migrations/*_profile_deal_aggregates_rpc.sql.
 */

/** Public profile pages render at most this many recent deals. */
export const PROFILE_DEAL_LIST_LIMIT = 10

/** Columns the profile lists render, in one place for both pages. */
const RECENT_DEAL_COLUMNS = 'id, title, product_name, status, amount, created_at'

export type ProfileDealRow = {
  id: string
  title: string
  product_name: string | null
  status: string
  amount: number
  created_at: string | null
}

export type InvestorDealAggregates = {
  totalDeals: number
  totalDeployed: number
  activeDeals: number
  activeVolume: number
  completedDeals: number
}

export type PymeDealAggregates = {
  totalDeals: number
  activeDeals: number
  completedDeals: number
  totalRepaid: number
  /** Deals that ever received funding — denominator for the page completion rate. */
  fundedDeals: number
  /** Reputation inputs, pre-aggregated by the RPC so no deal rows are transferred. */
  reputationStats: PymeReputationStats
}

// Factories rather than shared constants, so a caller can never mutate the
// fallback object another call receives.
function emptyReputationStats(): PymeReputationStats {
  return {
    totalRepaid: 0,
    currentDebt: 0,
    dealsCompleted: 0,
    dealsFunded: 0,
    dealsCancelled: 0,
  }
}

function emptyInvestorAggregates(): InvestorDealAggregates {
  return {
    totalDeals: 0,
    totalDeployed: 0,
    activeDeals: 0,
    activeVolume: 0,
    completedDeals: 0,
  }
}

function emptyPymeAggregates(): PymeDealAggregates {
  return {
    totalDeals: 0,
    activeDeals: 0,
    completedDeals: 0,
    totalRepaid: 0,
    fundedDeals: 0,
    reputationStats: emptyReputationStats(),
  }
}

function toNumber(value: unknown): number {
  if (value == null) return 0
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function firstRow(data: unknown): Record<string, unknown> | null {
  if (!Array.isArray(data) || data.length === 0) return null
  return (data[0] ?? null) as Record<string, unknown> | null
}

/**
 * Most recent deals for a profile, newest first and capped at `limit`.
 */
export async function fetchRecentProfileDeals(
  supabase: SupabaseClient,
  column: 'investor_id' | 'pyme_id',
  profileId: string,
  limit: number = PROFILE_DEAL_LIST_LIMIT,
): Promise<ProfileDealRow[]> {
  const { data } = await supabase
    .from('deals')
    .select(RECENT_DEAL_COLUMNS)
    .eq(column, profileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as ProfileDealRow[]
}

/**
 * Headline deal numbers for an investor profile.
 */
export async function getInvestorDealAggregates(
  supabase: SupabaseClient,
  investorId: string,
): Promise<InvestorDealAggregates> {
  const { data } = await supabase.rpc('investor_profile_deal_summary', {
    p_investor_id: investorId,
  })
  const row = firstRow(data)
  if (!row) return emptyInvestorAggregates()

  return {
    totalDeals: toNumber(row.total_deals),
    totalDeployed: toNumber(row.total_deployed),
    activeDeals: toNumber(row.active_deals),
    activeVolume: toNumber(row.active_volume),
    completedDeals: toNumber(row.completed_deals),
  }
}

/**
 * Headline deal numbers and reputation inputs for a PyME profile.
 *
 * `reputationStats` is shaped for `computePymeReputation`, so the profile page no
 * longer needs the raw deal rows to score the PyME.
 */
export async function getPymeDealAggregates(
  supabase: SupabaseClient,
  pymeId: string,
): Promise<PymeDealAggregates> {
  const { data } = await supabase.rpc('pyme_profile_deal_summary', {
    p_pyme_id: pymeId,
  })
  const row = firstRow(data)
  if (!row) return emptyPymeAggregates()

  const totalRepaid = toNumber(row.total_repaid)
  const completedDeals = toNumber(row.completed_deals)

  return {
    totalDeals: toNumber(row.total_deals),
    activeDeals: toNumber(row.active_deals),
    completedDeals,
    totalRepaid,
    fundedDeals: toNumber(row.funded_deals),
    reputationStats: {
      totalRepaid,
      currentDebt: toNumber(row.reputation_current_debt),
      dealsCompleted: completedDeals,
      dealsFunded: toNumber(row.reputation_deals_funded),
      dealsCancelled: toNumber(row.cancelled_deals),
    },
  }
}

/**
 * Share of funded deals that completed, as a whole percentage.
 * Returns null when the PyME has never been funded (rendered as "-").
 */
export function computeCompletionRate(completed: number, funded: number): number | null {
  if (funded <= 0) return null
  return Math.round((completed / funded) * 100)
}
