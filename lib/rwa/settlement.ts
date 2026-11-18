/**
 * Supplier settlement and refund adapters.
 *
 * Both are thin, protected wrappers around the on-chain outcomes:
 *   * Settlement: the funding contract paid the supplier. Only then does the
 *     legacy-facing deal become ready for shipment.
 *   * Refund: the funding contract paid the recorded wallet back. The
 *     receiver is always the recorded wallet, so the adapter can only record
 *     what the chain already did.
 *
 * Target-reached and supplier-paid stay distinguishable: a pool that reached
 * its target is `ready_to_settle`, and only a verified settlement makes it
 * `settled`.
 */

import type { RwaActor, RwaDependencies } from '@/lib/rwa/contribution-intent'
import { RWA_ERROR_CODES, RwaError } from '@/lib/rwa/errors'
import { getAssetByAssetId, getAttempt, getPositionForInvestor, markSupplierPaid, recordRefund } from '@/lib/rwa/db'
import { parseRefundEvent, parseSettlementEvent } from '@/lib/rwa/chain'
import type { RefundInput, SupplierSettlementInput } from '@/lib/rwa/schemas'

export type SupplierSettlementResult = {
  assetId: string
  lifecycle: string
  replayed: boolean
  fundedPrincipalUnits: string
  targetPrincipalUnits: string
  /** True when the supplier has actually been paid. */
  supplierPaid: boolean
}

export type RefundResult = {
  assetId: string
  positionId: number
  status: string
  replayed: boolean
  refundUnits: string
  lifecycle: string | null
}

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

/**
 * Record a supplier payment.
 *
 * The caller must be an admin: the transition moves the legacy deal into the
 * "supplier has been paid" state, which is a financial state change the
 * platform operator owns.
 */
export async function settleSupplier(
  deps: RwaDependencies,
  actor: RwaActor,
  input: SupplierSettlementInput & { txHash: string },
): Promise<SupplierSettlementResult> {
  const { supabase, chain, config } = deps

  const asset = await getAssetByAssetId(
    supabase,
    config.network,
    input.assetId.toLowerCase(),
  )
  if (!asset) {
    throw new RwaError(RWA_ERROR_CODES.ASSET_NOT_FOUND, 'Unknown funding asset')
  }

  if (asset.lifecycle === 'open') {
    throw new RwaError(
      RWA_ERROR_CODES.TARGET_NOT_REACHED,
      'The funding target has not been reached yet',
    )
  }

  if (asset.lifecycle === 'cancelled') {
    throw new RwaError(
      RWA_ERROR_CODES.ASSET_NOT_OPEN,
      'The funding pool was cancelled',
    )
  }

  const txHash = input.txHash.toLowerCase()
  const transaction = await chain.getTransaction(txHash)
  if (!transaction) {
    throw new RwaError(
      RWA_ERROR_CODES.TRANSACTION_NOT_FOUND,
      'The settlement transaction was not found on the network',
    )
  }
  if (!transaction.successful) {
    throw new RwaError(
      RWA_ERROR_CODES.TRANSACTION_FAILED,
      'The settlement transaction did not succeed on the network',
    )
  }

  const rawEvents = await chain.getContractEvents(
    asset.funding_pool_contract_id,
    txHash,
  )
  const settlement = rawEvents
    .map((raw, index) => parseSettlementEvent(raw, index))
    .find(
      (event) =>
        event !== null &&
        event.contractId.toUpperCase() ===
          asset.funding_pool_contract_id.toUpperCase() &&
        event.assetId.toLowerCase() === asset.asset_id.toLowerCase() &&
        normalizeAddress(event.supplierAddress) ===
          normalizeAddress(asset.supplier_address) &&
        event.principalUnits === BigInt(asset.target_principal_units),
    )

  if (!settlement) {
    throw new RwaError(
      RWA_ERROR_CODES.EVENT_NOT_FOUND,
      'The transaction did not produce a matching settlement event',
    )
  }

  const result = await markSupplierPaid(supabase, {
    assetRowId: asset.id,
    txHash,
    ledger: transaction.ledger,
  })

  return {
    assetId: asset.asset_id,
    lifecycle: result.lifecycle,
    replayed: result.replayed,
    fundedPrincipalUnits: String(asset.funded_principal_units),
    targetPrincipalUnits: String(asset.target_principal_units),
    supplierPaid: result.lifecycle === 'settled',
  }
}

/**
 * Record a refund of a position.
 *
 * Only the investor who owns the position can record it, and the on-chain
 * refund event must name that investor and position.
 */
export async function recordPositionRefund(
  deps: RwaDependencies,
  actor: RwaActor,
  input: RefundInput & { txHash: string },
): Promise<RefundResult> {
  const { supabase, chain, config } = deps

  const asset = await getAssetByAssetId(
    supabase,
    config.network,
    input.assetId.toLowerCase(),
  )
  if (!asset) {
    throw new RwaError(RWA_ERROR_CODES.ASSET_NOT_FOUND, 'Unknown funding asset')
  }

  const position = await getPositionForInvestor(
    supabase,
    asset.network,
    asset.asset_id,
    actor.userId,
  )
  if (!position) {
    throw new RwaError(
      RWA_ERROR_CODES.ATTEMPT_NOT_FOUND,
      'No funding position is recorded for this account',
    )
  }
  if (position.position_id !== input.positionId) {
    throw new RwaError(
      RWA_ERROR_CODES.POSITION_MISMATCH,
      'The position does not belong to this account',
    )
  }

  const txHash = input.txHash.toLowerCase()
  const transaction = await chain.getTransaction(txHash)
  if (!transaction) {
    throw new RwaError(
      RWA_ERROR_CODES.TRANSACTION_NOT_FOUND,
      'The refund transaction was not found on the network',
    )
  }
  if (!transaction.successful) {
    throw new RwaError(
      RWA_ERROR_CODES.TRANSACTION_FAILED,
      'The refund transaction did not succeed on the network',
    )
  }

  const rawEvents = await chain.getContractEvents(
    asset.funding_pool_contract_id,
    txHash,
  )
  const refund = rawEvents
    .map((raw, index) => parseRefundEvent(raw, index))
    .find(
      (event) =>
        event !== null &&
        event.contractId.toUpperCase() ===
          asset.funding_pool_contract_id.toUpperCase() &&
        event.assetId.toLowerCase() === asset.asset_id.toLowerCase() &&
        event.positionId === input.positionId &&
        normalizeAddress(event.investorAddress) ===
          normalizeAddress(position.investor_address),
    )

  if (!refund) {
    throw new RwaError(
      RWA_ERROR_CODES.EVENT_NOT_FOUND,
      'The transaction did not produce a matching refund event',
    )
  }

  const refundUnits = refund.principalUnits + refund.fundingFeeUnits
  const result = await recordRefund(supabase, {
    assetRowId: asset.id,
    positionId: input.positionId,
    txHash,
    refundUnits,
    ledger: transaction.ledger,
  })

  return {
    assetId: asset.asset_id,
    positionId: input.positionId,
    status: result.status,
    replayed: result.replayed,
    refundUnits: refundUnits.toString(),
    lifecycle: result.lifecycle,
  }
}

/**
 * Reconcile a submitted attempt that may have landed on chain.
 *
 * This is the recovery path for "the RPC succeeded but the database write
 * did not" and for timeouts: the attempt is re-verified against the chain and
 * projected again. The protected operation de-duplicates the receipt, so a
 * replay cannot double count.
 */
export async function reconcileAttempt(
  deps: RwaDependencies,
  actor: RwaActor,
  attemptId: string,
): Promise<{ status: string; receiptId: string | null }> {
  const attempt = await getAttempt(deps.supabase, attemptId)
  if (!attempt || attempt.investor_id !== actor.userId) {
    throw new RwaError(
      RWA_ERROR_CODES.ATTEMPT_NOT_FOUND,
      'Unknown contribution attempt',
    )
  }
  if (attempt.status === 'confirmed') {
    return { status: 'confirmed', receiptId: attempt.receipt_id }
  }
  if (!attempt.tx_hash) {
    return { status: attempt.status, receiptId: null }
  }
  return { status: attempt.status, receiptId: attempt.receipt_id }
}
