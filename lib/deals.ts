import type { Deal, DealStatus, FundingStatus, Milestone } from './types'
import { calculateYieldAPR } from './yield'

/** DB deal row with optional relations from Supabase select */
export interface DealRow {
  id: string
  pyme_id: string
  supplier_id?: string | null
  investor_id?: string | null
  title: string
  description: string
  category: string
  product_name: string
  product_quantity: number
  product_unit_price: number
  supplier_name: string
  amount: number
  interest_rate: number
  yield_bonus_apr?: number | null
  term_days: number
  status: string
  escrow_address?: string | null
  escrow_contract_address?: string | null
  funding_expires_at?: string | null
  funding_window_days?: number | null
  extension_count?: number | null
  extended_at?: string | null
  created_at?: string | null
  funded_at?: string | null
  completed_at?: string | null
  milestones?: MilestoneRow[] | null
  /** From Supabase select with alias: pyme:profiles!deals_pyme_id_fkey(...) */
  pyme?: {
    company_name?: string
    full_name?: string
    contact_name?: string
    stake_amount?: number | null
  } | null
  /** From Supabase select with alias: investor:profiles!deals_investor_id_fkey(...) */
  investor?: { company_name?: string; full_name?: string; contact_name?: string } | null
  /** From Supabase select: supplier_companies!deals_supplier_id_fkey(...) */
  supplier?: {
    company_name?: string
    full_name?: string
    contact_name?: string
    owner_id?: string
    address?: string
  } | null
  /** Fallback if relation is returned as table name */
  profiles?: { company_name?: string; full_name?: string; contact_name?: string } | null
}

export interface MilestoneRow {
  id: string
  deal_id: string
  title: string
  description?: string | null
  percentage: number
  amount: number
  status: string
  proof_notes?: string | null
  proof_document_url?: string | null
  completed_at?: string | null
}

const DB_STATUS_TO_DEAL_STATUS: Record<string, DealStatus> = {
  seeking_funding: 'awaiting_funding',
  funded: 'funded',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'completed',
}

const FUNDED_DB_STATUSES = new Set(['funded', 'in_progress', 'completed', 'cancelled'])

export function getFundingTimeRemainingMs(
  fundingExpiresAt?: string | null,
  nowMs = Date.now()
): number | null {
  if (!fundingExpiresAt) return null
  const expiresAtMs = Date.parse(fundingExpiresAt)
  if (!Number.isFinite(expiresAtMs)) return null
  return expiresAtMs - nowMs
}

export function getDealFundingStatus(
  row: Pick<
    DealRow,
    'status' | 'investor_id' | 'funded_at' | 'funding_expires_at' | 'extension_count'
  >,
  nowMs = Date.now()
): FundingStatus {
  const hasInvestment =
    Boolean(row.investor_id) ||
    Boolean(row.funded_at) ||
    FUNDED_DB_STATUSES.has(row.status)

  if (hasInvestment) return 'funded'
  if (row.status !== 'seeking_funding') return 'funded'

  const remainingMs = getFundingTimeRemainingMs(row.funding_expires_at, nowMs)
  if (remainingMs != null && remainingMs <= 0) return 'expired'

  const extensionCount = Number(row.extension_count ?? 0)
  if (extensionCount > 0) return 'extended'

  return 'open'
}

/**
 * Map a Supabase deal row (with optional milestones and pyme profile) to the Deal type used by DealCard and the deals browse page.
 */
export function mapDealFromDb(row: DealRow): Deal {
  const pymeProfile = row.pyme ?? row.profiles
  const pymeName =
    pymeProfile?.company_name ||
    pymeProfile?.full_name ||
    pymeProfile?.contact_name ||
    'PyME'

  const pymeStakeAmount =
    pymeProfile && 'stake_amount' in pymeProfile
      ? Number(pymeProfile.stake_amount ?? 0)
      : 0

  const investorName =
    row.investor?.company_name ||
    row.investor?.full_name ||
    row.investor?.contact_name ||
    undefined

  // Sort to match escrow order: index 0 = Shipment, 1 = Delivery. Title DESC gives [Shipment, Delivery].
  const rawMilestones = (row.milestones ?? []).slice().sort((a, b) =>
    (b.title ?? '') > (a.title ?? '') ? 1 : (b.title ?? '') < (a.title ?? '') ? -1 : 0
  )
  const milestones: Milestone[] = rawMilestones.map((m) => ({
    id: m.id,
    name: m.title,
    percentage: Number(m.percentage),
    status:
      m.status === 'completed'
        ? 'completed'
        : m.status === 'in_progress'
          ? 'in_progress'
          : 'pending',
    completedAt: m.completed_at ?? undefined,
    proofNotes: m.proof_notes ?? undefined,
    proofDocumentUrl: m.proof_document_url ?? undefined,
  }))

  const status = DB_STATUS_TO_DEAL_STATUS[row.status] ?? 'awaiting_funding'
  const fundingStatus = getDealFundingStatus(row)
  const extensionCount = Math.max(0, Number(row.extension_count ?? 0))

  const supplierCompany = row.supplier
  const supplierName =
    row.supplier_name ||
    supplierCompany?.company_name ||
    supplierCompany?.full_name ||
    supplierCompany?.contact_name ||
    'Supplier'

  return {
    id: row.id,
    productName: row.product_name || row.title,
    quantity: row.product_quantity ?? 0,
    priceUSDC: Number(row.amount),
    supplier: supplierName,
    supplierId: row.supplier_id ?? undefined,
    supplierOwnerId: supplierCompany?.owner_id ?? undefined,
    supplierAddress: supplierCompany?.address?.trim() || row.escrow_contract_address?.trim() || row.escrow_address?.trim() || undefined,
    term: row.term_days ?? 0,
    status,
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
    fundedAt: row.funded_at ? new Date(row.funded_at).toISOString().slice(0, 10) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString().slice(0, 10) : undefined,
    milestones,
    escrowAddress: row.escrow_contract_address ?? row.escrow_address ?? undefined,
    pymeName,
    pymeId: row.pyme_id ?? undefined,
    pymeStakeAmount:
      Number.isFinite(pymeStakeAmount) && pymeStakeAmount > 0
        ? pymeStakeAmount
        : undefined,
    investorName: investorName ?? undefined,
    investorId: row.investor_id ?? undefined,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    fundingStatus,
    fundingWindowDays:
      row.funding_window_days != null && Number.isFinite(Number(row.funding_window_days))
        ? Number(row.funding_window_days)
        : undefined,
    fundingExpiresAt: row.funding_expires_at
      ? new Date(row.funding_expires_at).toISOString()
      : undefined,
    extensionCount,
    extendedAt: row.extended_at
      ? new Date(row.extended_at).toISOString()
      : undefined,
    yieldAPR: (() => {
      const amount = Number(row.amount ?? 0)
      const termDays = row.term_days ?? 0
      if (amount <= 0 || termDays <= 0) return undefined
      const stored = row.interest_rate
      if (stored != null && Number.isFinite(Number(stored))) {
        return Math.round(Number(stored) * 100) / 100
      }
      return calculateYieldAPR(termDays, amount)
    })(),
    yieldBonusApr:
      row.yield_bonus_apr != null && Number.isFinite(Number(row.yield_bonus_apr))
        ? Math.round(Number(row.yield_bonus_apr) * 100) / 100
        : undefined,
  }
}
