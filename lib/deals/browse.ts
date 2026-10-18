import type { SupabaseClient } from '@supabase/supabase-js'
import { mapDealFromDb, type DealRow } from '@/lib/deals'
import type { Deal } from '@/lib/types'

/** Deals shown per page. One extra row is fetched to detect a following page. */
export const DEALS_PAGE_SIZE = 12

export type DealBrowseStatusFilter =
  | 'all'
  | 'open'
  | 'extended'
  | 'expired'
  | 'funded'
  | 'active'
  | 'completed'

export type DealBrowseSort =
  | 'newest'
  | 'highest_yield'
  | 'highest_amount'
  | 'shortest_term'

export const DEAL_BROWSE_SORTS: DealBrowseSort[] = [
  'newest',
  'highest_yield',
  'highest_amount',
  'shortest_term',
]

export interface DealBrowseFilters {
  status: DealBrowseStatusFilter
  category: string | null
  q: string
  sort: DealBrowseSort
  /** 1-based page number. */
  page: number
}

export interface DealsBrowseSummary {
  total: number
  open: number
  expired: number
  active: number
  completed: number
  totalValue: number
}

export interface DealsBrowseMeta {
  summary: DealsBrowseSummary
  categories: string[]
}

export interface DealsBrowsePage {
  deals: Deal[]
  page: number
  hasMore: boolean
  matchCount: number
}

export interface DealsBrowseResponse extends DealsBrowsePage {
  summary: DealsBrowseSummary
  categories: string[]
}

/**
 * Explicit column selection for the marketplace list.
 *
 * Cards, filters and the summary tiles only read these columns, so the browse
 * query avoids `*` and the heavy `milestones(*)` payload: milestones only feed
 * the progress bar on each card, so their reduced fields are enough.
 */
const DEALS_BROWSE_COLUMNS = [
  'id',
  'pyme_id',
  'supplier_id',
  'investor_id',
  'product_id',
  'product_name',
  'title',
  'product_quantity',
  'amount',
  'interest_rate',
  'yield_bonus_apr',
  'supplier_name',
  'term_days',
  'status',
  'platform_fee',
  'description',
  'category',
  'created_at',
  'funded_at',
  'completed_at',
  'funding_expires_at',
  'funding_window_days',
  'extension_count',
  'extended_at',
  'escrow_address',
  'escrow_contract_address',
  'pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name, stake_amount)',
  'milestones(id, title, percentage, status, completed_at)',
]

export const DEALS_BROWSE_SELECT = DEALS_BROWSE_COLUMNS.join(', ')

const SEARCH_TERM_RESERVED = /[,()*%\\"]/g

/** Strip PostgREST/`or()` control characters from a user supplied search term. */
export function sanitizeSearchTerm(value: string): string {
  return value.replace(SEARCH_TERM_RESERVED, ' ').replace(/\s+/g, ' ').trim()
}

function uninvestedSeekingFundingClauses(): string[] {
  return ['status.eq.seeking_funding', 'investor_id.is.null', 'funded_at.is.null']
}

function fundingWindowOpenClause(nowIso: string): string {
  return `or(funding_expires_at.is.null,funding_expires_at.gt.${nowIso})`
}

function fundingWindowClosedClauses(nowIso: string): string[] {
  return ['funding_expires_at.not.is.null', `funding_expires_at.lte.${nowIso}`]
}

/**
 * PostgREST clauses for the status quick-filters, mirroring the previous
 * client-side `matchesStatusFilter` semantics.
 */
export function dealsStatusFilterClauses(
  status: DealBrowseStatusFilter,
  nowIso: string,
): string[] {
  switch (status) {
    case 'open':
      return [
        ...uninvestedSeekingFundingClauses(),
        'extension_count.eq.0',
        fundingWindowOpenClause(nowIso),
      ]
    case 'extended':
      return [
        ...uninvestedSeekingFundingClauses(),
        'extension_count.gt.0',
        fundingWindowOpenClause(nowIso),
      ]
    case 'expired':
      return [...uninvestedSeekingFundingClauses(), ...fundingWindowClosedClauses(nowIso)]
    case 'funded':
      return [
        'or(investor_id.not.is.null,funded_at.not.is.null,status.in.(funded,in_progress,completed,cancelled))',
      ]
    case 'active':
      return ['status.in.(funded,in_progress)']
    case 'completed':
      return ['status.in.(completed,cancelled)']
    default:
      return []
  }
}

export type DealsSummaryCountKind = 'open' | 'expired' | 'active' | 'completed'

/** PostgREST clauses for the stat tiles (the `open` tile also counts extended deals). */
export function dealsSummaryStatusClauses(
  kind: DealsSummaryCountKind,
  nowIso: string,
): string[] {
  switch (kind) {
    case 'open':
      return [...uninvestedSeekingFundingClauses(), fundingWindowOpenClause(nowIso)]
    case 'expired':
      return [...uninvestedSeekingFundingClauses(), ...fundingWindowClosedClauses(nowIso)]
    case 'active':
      return ['status.in.(funded,in_progress)']
    case 'completed':
      return ['status.in.(completed,cancelled)']
  }
}

/**
 * Search clause covering the fields the cards display. PyME names live on the
 * embedded profile row, so their ids are resolved by a separate profiles query
 * and matched through `pyme_id.in.(...)`.
 */
export function dealsSearchClause(q: string, pymeIds: string[] = []): string | null {
  const term = sanitizeSearchTerm(q)
  if (!term) return null
  const pattern = `*${term}*`
  const clauses = [
    `product_name.ilike.${pattern}`,
    `title.ilike.${pattern}`,
    `supplier_name.ilike.${pattern}`,
  ]
  const ids = pymeIds.filter((id) => typeof id === 'string' && id.length > 0)
  if (ids.length > 0) clauses.push(`pyme_id.in.(${ids.join(',')})`)
  return `or(${clauses.join(',')})`
}

export function dealsBrowseFilterClauses(
  filters: DealBrowseFilters,
  nowIso: string,
  pymeIds: string[] = [],
): string[] {
  const clauses = dealsStatusFilterClauses(filters.status, nowIso)
  const search = dealsSearchClause(filters.q, pymeIds)
  if (search) clauses.push(search)
  return clauses
}

/**
 * Combine clauses into a single PostgREST expression. A lone `or(...)` group is
 * unwrapped because `.or()` already supplies the `or` group, keeping the logic
 * tree shallow.
 */
export function dealsBrowseFilterExpression(clauses: string[]): string | null {
  if (clauses.length === 0) return null
  if (clauses.length === 1) {
    const [only] = clauses
    if (only.startsWith('or(') && only.endsWith(')')) return only.slice(3, -1)
    return only
  }
  return `and(${clauses.join(',')})`
}

const FILTER_PARAM_TO_STATUS: Record<string, DealBrowseStatusFilter> = {
  all: 'all',
  open: 'open',
  extended: 'extended',
  expired: 'expired',
  funded: 'funded',
  active: 'active',
  completed: 'completed',
  // Legacy `?filter=` values used across the app.
  awaiting_funding: 'open',
  seeking_funding: 'open',
  in_progress: 'active',
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseDealsBrowseParams(
  params: Record<string, string | string[] | undefined>,
): DealBrowseFilters {
  const filterParam = firstParam(params.filter)
  const statusParam = firstParam(params.status)
  const status =
    (filterParam ? FILTER_PARAM_TO_STATUS[filterParam] : undefined) ??
    (statusParam ? FILTER_PARAM_TO_STATUS[statusParam] : undefined) ??
    'all'

  const categoryParam = (firstParam(params.category) ?? '').trim()
  const q = (firstParam(params.q) ?? '').trim()

  const sortParam = firstParam(params.sort)
  const sort = DEAL_BROWSE_SORTS.includes(sortParam as DealBrowseSort)
    ? (sortParam as DealBrowseSort)
    : 'newest'

  const pageParam = Number(firstParam(params.page))
  const page = Number.isFinite(pageParam) && pageParam > 1 ? Math.floor(pageParam) : 1

  return { status, category: categoryParam || null, q, sort, page }
}

/** Inclusive PostgREST range for a page. The extra row signals `hasMore`. */
export function dealsBrowseRange(page: number): { from: number; to: number } {
  const safePage = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1
  const from = (safePage - 1) * DEALS_PAGE_SIZE
  return { from, to: from + DEALS_PAGE_SIZE }
}

export function dealBrowseCacheKey(filters: DealBrowseFilters): string {
  return [filters.status, filters.category ?? '', filters.q, filters.sort, filters.page].join('|')
}

async function resolveSearchPymeIds(client: SupabaseClient, q: string): Promise<string[]> {
  const term = sanitizeSearchTerm(q)
  if (!term) return []
  const pattern = `*${term}*`
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .or(`company_name.ilike.${pattern},full_name.ilike.${pattern},contact_name.ilike.${pattern}`)
    .limit(500)

  if (error) {
    console.error('[deals-browse] profile search failed', error.message)
    return []
  }
  return ((data ?? []) as { id: string }[]).map((row) => row.id)
}

async function countDeals(
  client: SupabaseClient,
  clauses: string[],
  category: string | null,
): Promise<number> {
  let query = client.from('deals').select('id', { count: 'exact', head: true })
  const expression = dealsBrowseFilterExpression(clauses)
  if (expression) query = query.or(expression)
  if (category) query = query.eq('category', category)
  const { count, error } = await query
  if (error) {
    console.error('[deals-browse] count failed', error.message)
    return 0
  }
  return count ?? 0
}

/** Summary tiles + category options, aggregated server-side. */
export async function fetchDealsBrowseMeta(client: SupabaseClient): Promise<DealsBrowseMeta> {
  const nowIso = new Date().toISOString()
  const [total, open, expired, active, completed, meta] = await Promise.all([
    countDeals(client, [], null),
    countDeals(client, dealsSummaryStatusClauses('open', nowIso), null),
    countDeals(client, dealsSummaryStatusClauses('expired', nowIso), null),
    countDeals(client, dealsSummaryStatusClauses('active', nowIso), null),
    countDeals(client, dealsSummaryStatusClauses('completed', nowIso), null),
    // Narrow column read used for the total value and the category options.
    client.from('deals').select('amount, category'),
  ])

  if (meta.error) {
    console.error('[deals-browse] meta query failed', meta.error.message)
  }
  const rows = (meta.data ?? []) as { amount?: number | string | null; category?: string | null }[]

  const categories = Array.from(
    new Set(
      rows
        .map((row) => row.category)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  ).sort()

  const totalValue = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  return {
    summary: { total, open, expired, active, completed, totalValue },
    categories,
  }
}

/** Fetch a single page plus the filtered match count, executed in the database. */
export async function fetchDealsBrowsePage(
  client: SupabaseClient,
  filters: DealBrowseFilters,
): Promise<DealsBrowsePage> {
  const nowIso = new Date().toISOString()
  const pymeIds = await resolveSearchPymeIds(client, filters.q)
  const clauses = dealsBrowseFilterClauses(filters, nowIso, pymeIds)
  const { from, to } = dealsBrowseRange(filters.page)

  let query = client.from('deals').select(DEALS_BROWSE_SELECT)
  const expression = dealsBrowseFilterExpression(clauses)
  if (expression) query = query.or(expression)
  if (filters.category) query = query.eq('category', filters.category)

  switch (filters.sort) {
    case 'highest_yield':
      query = query.order('interest_rate', { ascending: false })
      break
    case 'highest_amount':
      query = query.order('amount', { ascending: false })
      break
    case 'shortest_term':
      query = query.order('term_days', { ascending: true })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }
  // Stable tiebreaker so range pagination never repeats or drops rows.
  query = query.order('id', { ascending: false })

  const [pageResult, matchCount] = await Promise.all([
    query.range(from, to),
    countDeals(client, clauses, filters.category),
  ])

  if (pageResult.error) {
    console.error('[deals-browse] query failed', pageResult.error.message)
    return { deals: [], page: filters.page, hasMore: false, matchCount: 0 }
  }

  const rows = (pageResult.data ?? []) as DealRow[]
  return {
    deals: rows.slice(0, DEALS_PAGE_SIZE).map(mapDealFromDb),
    page: filters.page,
    hasMore: rows.length > DEALS_PAGE_SIZE,
    matchCount,
  }
}
