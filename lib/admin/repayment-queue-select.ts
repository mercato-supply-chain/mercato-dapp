/**
 * Authoritative deal projection shared by the admin repayment queue and the
 * stale-data guard. Kept free of server-only imports so both the queue
 * (server) and the guard (client, immediately before signing) can reuse the
 * same columns without duplicating the query.
 */
export const REPAYMENT_QUEUE_DEAL_SELECT = `id, title, product_name, amount, interest_rate, term_days, escrow_contract_address, repayment_status, repayment_total_amount, repayment_milestones, created_at, pyme_id, supplier_id, investor_id,
  pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name, address),
  supplier:supplier_companies(company_name, full_name, contact_name, logo_url),
  investor:profiles!deals_investor_id_fkey(address, full_name, company_name, contact_name)`

/** Row shape returned by `REPAYMENT_QUEUE_DEAL_SELECT` (minimal subset). */
export type RepaymentQueueDealRow = {
  id: string
  escrow_contract_address: string | null
  repayment_status: string | null
  repayment_total_amount: number | null
  amount?: number | null
  interest_rate: number | null
  term_days: number | null
  investor_id?: string | null
  investor?: { address?: string | null } | null
}