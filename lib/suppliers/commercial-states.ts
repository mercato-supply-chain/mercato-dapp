import { getDealFundingStatus, type DealRow } from '@/lib/deals'

/** Supplier-facing commercial lifecycle (derived from deal fields, not stored). */
export type SupplierCommercialState =
  | 'financing_request'
  | 'expired'
  | 'cancelled'
  | 'financed_sale'
  | 'needs_shipment'
  | 'in_fulfillment'
  | 'completed_sale'

/** All supplier commercial states, in lifecycle display order. */
export const SUPPLIER_COMMERCIAL_STATES: SupplierCommercialState[] = [
  'financing_request',
  'expired',
  'cancelled',
  'financed_sale',
  'needs_shipment',
  'in_fulfillment',
  'completed_sale',
]

export type SupplierCommercialDealRow = Pick<
  DealRow,
  | 'status'
  | 'investor_id'
  | 'funded_at'
  | 'funding_expires_at'
  | 'extension_count'
  | 'shipped_at'
  | 'delivered_at'
>

const FINANCED_DB_STATUSES = new Set(['funded', 'in_progress', 'completed'])

function isFinancedSale(row: SupplierCommercialDealRow): boolean {
  return FINANCED_DB_STATUSES.has(row.status)
}

/**
 * Primary supplier commercial state for display and filtering.
 * Evaluated in lifecycle priority (most specific first).
 */
export function getSupplierCommercialState(
  row: SupplierCommercialDealRow,
  nowMs = Date.now(),
): SupplierCommercialState {
  if (row.status === 'cancelled') return 'cancelled'

  if (row.status === 'seeking_funding') {
    const fundingStatus = getDealFundingStatus(row, nowMs)
    if (fundingStatus === 'expired') return 'expired'
    return 'financing_request'
  }

  if (row.status === 'completed') return 'completed_sale'

  if (row.shipped_at && !row.delivered_at) return 'in_fulfillment'

  if (isFinancedSale(row) && !row.shipped_at) return 'needs_shipment'

  if (isFinancedSale(row)) return 'financed_sale'

  return 'financing_request'
}

/** Whether the deal counts as an open financing request (not expired/cancelled). */
export function isOpenFinancingRequest(
  row: SupplierCommercialDealRow,
  nowMs = Date.now(),
): boolean {
  return getSupplierCommercialState(row, nowMs) === 'financing_request'
}

/** Whether the deal is an active financed sale (funded or in progress, not completed/cancelled). */
export function isActiveFinancedSale(row: SupplierCommercialDealRow): boolean {
  return row.status === 'funded' || row.status === 'in_progress'
}

/** Whether the deal needs supplier shipment action. */
export function needsSupplierShipment(row: SupplierCommercialDealRow): boolean {
  return isFinancedSale(row) && !row.shipped_at && row.status !== 'completed'
}
