import type { Deal, DealStatus, Milestone } from './types'

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
  term_days: number
  status: string
  escrow_address?: string | null
  escrow_contract_address?: string | null
  created_at?: string | null
  funded_at?: string | null
  completed_at?: string | null
  milestones?: MilestoneRow[] | null
  /** From Supabase select with alias: pyme:profiles!deals_pyme_id_fkey(...) */
  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
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

/**
 * Map a Supabase deal row (with optional milestones and pyme profile) to the Deal type used by DealCard and marketplace.
 */
export function mapDealFromDb(row: DealRow): Deal {
  const pymeProfile = row.pyme ?? row.profiles
  const pymeName =
    pymeProfile?.company_name ||
    pymeProfile?.full_name ||
    pymeProfile?.contact_name ||
    'PyME'

  const investorName =
    row.investor?.company_name ||
    row.investor?.full_name ||
    row.investor?.contact_name ||
    undefined

  const milestones: Milestone[] = (row.milestones ?? []).map((m) => ({
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
    investorName: investorName ?? undefined,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    yieldAPR: row.interest_rate != null ? Number(row.interest_rate) : undefined,
  }
}
