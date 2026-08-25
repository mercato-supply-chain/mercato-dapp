import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminUserCompany,
  AdminUserDetail,
  AdminUserListItem,
  AdminUsersFilters,
  AdminUsersResult,
  AdminUsersSort,
} from './types'
import { getAdminAuditEvents } from './admin-audit'

export const USERS_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

const ROLES = new Set(['pyme', 'investor', 'supplier', 'admin'])
const VERIFICATIONS = new Set(['verified', 'unverified'])
const ONBOARDINGS = new Set(['completed', 'incomplete', 'legacy'])
const WALLETS = new Set(['connected', 'none', 'pollar', 'stellar-wallets-kit'])
const SORTS = new Set<AdminUsersSort>(['newest', 'oldest', 'recently_updated'])

type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function parseUtcDate(value: string | null): string | null {
  if (!value) return null
  const match = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (!match) return null
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed) ? null : value
}

/** Parses and validates /dashboard/admin/users URL params. Invalid values fall back. */
export function parseAdminUsersSearchParams(sp: RawSearchParams): AdminUsersFilters {
  const role = first(sp.role)
  const verification = first(sp.verification)
  const onboarding = first(sp.onboarding)
  const wallet = first(sp.wallet)
  const sort = first(sp.sort)
  const rawPage = Number.parseInt(first(sp.page) ?? '', 10)
  const rawPageSize = Number.parseInt(first(sp.pageSize) ?? '', 10)
  const search = first(sp.q)?.trim() || null

  return {
    search,
    role: role && ROLES.has(role) ? (role as AdminUsersFilters['role']) : null,
    verification:
      verification && VERIFICATIONS.has(verification)
        ? (verification as AdminUsersFilters['verification'])
        : null,
    onboarding:
      onboarding && ONBOARDINGS.has(onboarding)
        ? (onboarding as AdminUsersFilters['onboarding'])
        : null,
    wallet: wallet && WALLETS.has(wallet) ? (wallet as AdminUsersFilters['wallet']) : null,
    signupFrom: parseUtcDate(first(sp.from)),
    signupTo: parseUtcDate(first(sp.to)),
    sort: sort && SORTS.has(sort as AdminUsersSort) ? (sort as AdminUsersSort) : 'newest',
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize:
      Number.isFinite(rawPageSize) && rawPageSize > 0
        ? Math.min(rawPageSize, MAX_PAGE_SIZE)
        : USERS_PAGE_SIZE,
  }
}

/** Serializes filters back into URL params (drops defaults). */
export function adminUsersSearchParams(filters: Partial<AdminUsersFilters>): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set('q', filters.search)
  if (filters.role) params.set('role', filters.role)
  if (filters.verification) params.set('verification', filters.verification)
  if (filters.onboarding) params.set('onboarding', filters.onboarding)
  if (filters.wallet) params.set('wallet', filters.wallet)
  if (filters.signupFrom) params.set('from', filters.signupFrom)
  if (filters.signupTo) params.set('to', filters.signupTo)
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  return params
}

const LIST_COLUMNS =
  'id, email, user_type, company_name, full_name, contact_name, country, verified, onboarding_completed_at, wallet_provider, wallet_status, created_at, updated_at'

type ProfileRow = {
  id: string
  email: string
  user_type: string | null
  company_name: string | null
  full_name: string | null
  contact_name: string | null
  country: string | null
  verified: boolean | null
  onboarding_completed_at: string | null
  wallet_provider: string | null
  wallet_status: string | null
  created_at: string
  updated_at: string | null
}

function mapProfile(row: ProfileRow): AdminUserListItem {
  return {
    id: row.id,
    email: row.email,
    userType: row.user_type,
    companyName: row.company_name,
    fullName: row.full_name,
    contactName: row.contact_name,
    country: row.country,
    verified: Boolean(row.verified),
    onboardingCompletedAt: row.onboarding_completed_at,
    walletProvider: row.wallet_provider,
    walletStatus: row.wallet_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function escapeSearchTerm(term: string): string {
  return term.replaceAll(/[%_,()]/g, ' ').trim()
}

/** Paginated, filterable user directory for admins. */
export async function getAdminUsers(
  supabase: SupabaseClient,
  filters: AdminUsersFilters,
): Promise<AdminUsersResult> {
  let query = supabase.from('profiles').select(LIST_COLUMNS, { count: 'exact' })

  if (filters.search) {
    const term = escapeSearchTerm(filters.search)
    if (term) {
      const pattern = `%${term}%`
      query = query.or(
        `full_name.ilike.${pattern},company_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`,
      )
    }
  }

  if (filters.role) query = query.eq('user_type', filters.role)
  if (filters.verification === 'verified') query = query.eq('verified', true)
  if (filters.verification === 'unverified') query = query.eq('verified', false)

  if (filters.onboarding === 'incomplete') {
    query = query.is('user_type', null)
  } else if (filters.onboarding === 'completed') {
    query = query.not('user_type', 'is', null).not('onboarding_completed_at', 'is', null)
  } else if (filters.onboarding === 'legacy') {
    query = query.not('user_type', 'is', null).is('onboarding_completed_at', null)
  }

  if (filters.wallet === 'connected') {
    query = query.not('wallet_provider', 'is', null)
  } else if (filters.wallet === 'none') {
    query = query.is('wallet_provider', null)
  } else if (filters.wallet) {
    query = query.eq('wallet_provider', filters.wallet)
  }

  if (filters.signupFrom) query = query.gte('created_at', `${filters.signupFrom}T00:00:00.000Z`)
  if (filters.signupTo) query = query.lte('created_at', `${filters.signupTo}T23:59:59.999Z`)

  if (filters.sort === 'recently_updated') {
    query = query.order('updated_at', { ascending: false, nullsFirst: false })
  } else {
    query = query.order('created_at', { ascending: filters.sort === 'oldest' })
  }

  const offset = (filters.page - 1) * filters.pageSize
  const { data, count, error } = await query.range(offset, offset + filters.pageSize - 1)

  if (error) {
    return { rows: [], total: 0, page: filters.page, pageSize: filters.pageSize }
  }

  return {
    rows: ((data ?? []) as unknown as ProfileRow[]).map(mapProfile),
    total: count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }
}

type CompanyRow = {
  id: string
  company_name: string | null
  country: string | null
  verified: boolean | null
  created_at: string
}

/** Full profile view: identity, companies, deal counts, recent audit trail. */
export async function getAdminUserDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminUserDetail | null> {
  const [profileRes, companiesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(`${LIST_COLUMNS}, phone, sector, website, bio, stellar_public_key`)
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('supplier_companies')
      .select('id, company_name, country, verified, created_at')
      .eq('owner_id', id)
      .order('created_at', { ascending: true }),
  ])

  const row = profileRes.data as
    | (ProfileRow & {
        phone: string | null
        sector: string | null
        website: string | null
        bio: string | null
        stellar_public_key: string | null
      })
    | null
  if (!row) return null

  const companies = (companiesRes.data ?? []) as CompanyRow[]

  const [pymeDealsRes, investorDealsRes, auditRes] = await Promise.all([
    supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('pyme_id', id),
    supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('investor_id', id),
    getAdminAuditEvents(supabase, {
      pageSize: 10,
      entityIds: [id, ...companies.map((company) => company.id)],
    }),
  ])

  return {
    profile: {
      ...mapProfile(row),
      phone: row.phone,
      sector: row.sector,
      website: row.website,
      bio: row.bio,
      stellarPublicKey: row.stellar_public_key,
    },
    companies: companies.map(
      (company): AdminUserCompany => ({
        id: company.id,
        companyName: company.company_name,
        country: company.country,
        verified: Boolean(company.verified),
        createdAt: company.created_at,
      }),
    ),
    recentAuditEvents: auditRes.rows,
    dealCounts: {
      asPyme: pymeDealsRes.count ?? 0,
      asInvestor: investorDealsRes.count ?? 0,
    },
  }
}
