/**
 * Typed access to the RWA tables and the protected RWA operations.
 *
 * The financial writes all go through the SECURITY DEFINER operations in
 * `supabase/migrations/20261020000100_rwa_contribution_projection.sql`. They
 * are never issued from a browser session: the server uses the service client
 * and performs its own authorization first.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  RWA_ERROR_CODES,
  RwaError,
  capacityFromDatabaseError,
  rwaCodeFromDatabaseError,
} from '@/lib/rwa/errors'

export type RwaAssetRow = {
  id: string
  asset_id: string
  network: string
  registry_contract_id: string
  funding_pool_contract_id: string
  token_contract_id: string
  token_decimals: number
  target_principal_units: number
  supplier_address: string
  fee_recipient_address: string
  excess_recipient_address: string
  funding_fee_bps: number
  fee_policy_version: number
  deadline_at: string
  lifecycle: 'open' | 'ready_to_settle' | 'settled' | 'cancelled'
  funded_principal_units: number
  funding_fee_units: number
  position_count: number
  target_reached_at: string | null
  supplier_paid_at: string | null
  deal_id: string | null
}

export type RwaAttemptRow = {
  id: string
  attempt_id: string
  idempotency_key: string
  asset_row_id: string
  network: string
  asset_id: string
  funding_pool_contract_id: string
  investor_id: string
  investor_address: string
  principal_units: number
  nonce: number
  contribution_ref: string
  status: 'prepared' | 'submitted' | 'confirmed' | 'failed' | 'expired'
  tx_hash: string | null
  receipt_id: string | null
  ledger: number | null
  reservation_expires_at: string | null
  confirmed_at: string | null
  failure_code: string | null
}

export type RwaPositionRow = {
  id: string
  asset_row_id: string
  network: string
  asset_id: string
  position_id: number
  investor_id: string
  investor_address: string
  principal_units: number
  ownership_units: number
  funding_fee_units: number
  contribution_count: number
  last_nonce: number
  last_contribution_ref: string
  status: 'open' | 'settled' | 'refunded'
}

export type RwaInvestorProfile = {
  id: string
  user_type: string | null
  /** Wallet registered on the profile. */
  address: string | null
  stellar_public_key: string | null
}

export type RwaReservation = {
  attempt_id: string
  status: string
  nonce: number
  contribution_ref: string
  principal_units: number
  asset_id: string
  network: string
  funding_pool_contract_id: string
  investor_address: string
  reservation_expires_at: string | null
  replayed: boolean
}

export type RwaProjection = {
  replayed: boolean
  target_reached?: boolean
  receipt_id: string | null
  position_id: number | null
  principal_units: number | null
  ownership_units: number | null
  funding_fee_units: number | null
  contribution_count: number | null
  lifecycle: string | null
}

const ASSET_COLUMNS =
  'id, asset_id, network, registry_contract_id, funding_pool_contract_id, token_contract_id, token_decimals, target_principal_units, supplier_address, fee_recipient_address, excess_recipient_address, funding_fee_bps, fee_policy_version, deadline_at, lifecycle, funded_principal_units, funding_fee_units, position_count, target_reached_at, supplier_paid_at, deal_id'

const ATTEMPT_COLUMNS =
  'id, attempt_id, idempotency_key, asset_row_id, network, asset_id, funding_pool_contract_id, investor_id, investor_address, principal_units, nonce, contribution_ref, status, tx_hash, receipt_id, ledger, reservation_expires_at, confirmed_at, failure_code'

/** Read the RWA asset row for a registry asset id on a given network. */
export async function getAssetByAssetId(
  supabase: SupabaseClient,
  network: string,
  assetId: string,
): Promise<RwaAssetRow | null> {
  const { data, error } = await supabase
    .from('rwa_assets')
    .select(ASSET_COLUMNS)
    .eq('network', network)
    .eq('asset_id', assetId.toLowerCase())
    .maybeSingle()

  if (error) throw error
  return (data as RwaAssetRow | null) ?? null
}

export async function getAssetByRowId(
  supabase: SupabaseClient,
  assetRowId: string,
): Promise<RwaAssetRow | null> {
  const { data, error } = await supabase
    .from('rwa_assets')
    .select(ASSET_COLUMNS)
    .eq('id', assetRowId)
    .maybeSingle()

  if (error) throw error
  return (data as RwaAssetRow | null) ?? null
}

/** Load the investor profile fields needed to authorise a contribution. */
export async function getInvestorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<RwaInvestorProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_type, address, stellar_public_key')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return (data as RwaInvestorProfile | null) ?? null
}

export async function getAttempt(
  supabase: SupabaseClient,
  attemptId: string,
): Promise<RwaAttemptRow | null> {
  const { data, error } = await supabase
    .from('rwa_contributions')
    .select(ATTEMPT_COLUMNS)
    .eq('attempt_id', attemptId)
    .maybeSingle()

  if (error) throw error
  return (data as RwaAttemptRow | null) ?? null
}

export async function getPositionForInvestor(
  supabase: SupabaseClient,
  network: string,
  assetId: string,
  investorId: string,
): Promise<RwaPositionRow | null> {
  const { data, error } = await supabase
    .from('rwa_positions')
    .select(
      'id, asset_row_id, network, asset_id, position_id, investor_id, investor_address, principal_units, ownership_units, funding_fee_units, contribution_count, last_nonce, last_contribution_ref, status',
    )
    .eq('network', network)
    .eq('asset_id', assetId.toLowerCase())
    .eq('investor_id', investorId)
    .maybeSingle()

  if (error) throw error
  return (data as RwaPositionRow | null) ?? null
}

/** Reserve capacity and allocate the nonce for a contribution intent. */
export async function reserveContribution(
  supabase: SupabaseClient,
  args: {
    attemptId: string
    idempotencyKey: string
    assetRowId: string
    investorId: string
    investorAddress: string
    principalUnits: bigint
  },
): Promise<RwaReservation> {
  const { data, error } = await supabase.rpc('rwa_reserve_contribution', {
    p_attempt_id: args.attemptId,
    p_idempotency_key: args.idempotencyKey,
    p_asset_row_id: args.assetRowId,
    p_investor_id: args.investorId,
    p_investor_address: args.investorAddress,
    p_principal_units: args.principalUnits.toString(),
  })

  if (error) {
    throw new RwaError(
      rwaCodeFromDatabaseError(error),
      'Could not reserve funding capacity',
      { availablePrincipalUnits: capacityFromDatabaseError(error) },
    )
  }

  const row = (data ?? {}) as Record<string, unknown>
  return {
    attempt_id: String(row.attempt_id ?? ''),
    status: String(row.status ?? 'prepared'),
    nonce: Number(row.nonce ?? 0),
    contribution_ref: String(row.contribution_ref ?? ''),
    principal_units: Number(row.principal_units ?? 0),
    asset_id: String(row.asset_id ?? ''),
    network: String(row.network ?? ''),
    funding_pool_contract_id: String(row.funding_pool_contract_id ?? ''),
    investor_address: String(row.investor_address ?? ''),
    reservation_expires_at: (row.reservation_expires_at as string | null) ?? null,
    replayed: Boolean(row.replayed),
  }
}

/** Record that the client submitted the transaction. */
export async function recordSubmission(
  supabase: SupabaseClient,
  args: { attemptId: string; txHash: string; ledger?: number | null },
): Promise<void> {
  const { error } = await supabase.rpc('rwa_record_submission', {
    p_attempt_id: args.attemptId,
    p_tx_hash: args.txHash,
    p_ledger: args.ledger ?? null,
  })

  if (error) {
    throw new RwaError(
      rwaCodeFromDatabaseError(error),
      'Could not record the submitted transaction',
    )
  }
}

/** Project a verified contribution into the database. */
export async function confirmContribution(
  supabase: SupabaseClient,
  args: {
    attemptId: string
    txHash: string
    receiptId: string
    eventIndex: number
    ledger: number | null
    investorAddress: string
    principalUnits: bigint
    fundingFeeUnits: bigint
    ownershipUnits: bigint
    nonce: bigint
    contributionRef: string
    positionId: number
  },
): Promise<RwaProjection> {
  const { data, error } = await supabase.rpc('rwa_confirm_contribution', {
    p_attempt_id: args.attemptId,
    p_tx_hash: args.txHash,
    p_receipt_id: args.receiptId,
    p_event_index: args.eventIndex,
    p_ledger: args.ledger ?? null,
    p_observed_investor_address: args.investorAddress,
    p_observed_principal_units: args.principalUnits.toString(),
    p_observed_funding_fee_units: args.fundingFeeUnits.toString(),
    p_observed_ownership_units: args.ownershipUnits.toString(),
    p_observed_nonce: args.nonce.toString(),
    p_observed_contribution_ref: args.contributionRef,
    p_observed_position_id: args.positionId,
  })

  if (error) {
    throw new RwaError(
      rwaCodeFromDatabaseError(error),
      'Could not project the confirmed contribution',
    )
  }

  const row = (data ?? {}) as Record<string, unknown>
  return {
    replayed: Boolean(row.replayed),
    target_reached: Boolean(row.target_reached),
    receipt_id: (row.receipt_id as string | null) ?? null,
    position_id: row.position_id == null ? null : Number(row.position_id),
    principal_units: row.principal_units == null ? null : Number(row.principal_units),
    ownership_units: row.ownership_units == null ? null : Number(row.ownership_units),
    funding_fee_units: row.funding_fee_units == null ? null : Number(row.funding_fee_units),
    contribution_count:
      row.contribution_count == null ? null : Number(row.contribution_count),
    lifecycle: (row.lifecycle as string | null) ?? null,
  }
}

/** Mark a definitively failed attempt. */
export async function markAttemptFailed(
  supabase: SupabaseClient,
  attemptId: string,
  failureCode: string,
): Promise<void> {
  const { error } = await supabase.rpc('rwa_mark_attempt_failed', {
    p_attempt_id: attemptId,
    p_failure_code: failureCode,
  })

  if (error) {
    throw new RwaError(
      rwaCodeFromDatabaseError(error),
      'Could not mark the contribution attempt as failed',
    )
  }
}

/** Mark the supplier as paid. Only valid once the target has been reached. */
export async function markSupplierPaid(
  supabase: SupabaseClient,
  args: { assetRowId: string; txHash: string; ledger?: number | null },
): Promise<{ lifecycle: string; replayed: boolean }> {
  const { data, error } = await supabase.rpc('rwa_mark_supplier_paid', {
    p_asset_row_id: args.assetRowId,
    p_tx_hash: args.txHash,
    p_ledger: args.ledger ?? null,
  })

  if (error) {
    throw new RwaError(
      rwaCodeFromDatabaseError(error),
      'Could not record the supplier payment',
    )
  }

  const row = (data ?? {}) as Record<string, unknown>
  return {
    lifecycle: String(row.lifecycle ?? ''),
    replayed: Boolean(row.replayed),
  }
}

/** Record a refund of a position. */
export async function recordRefund(
  supabase: SupabaseClient,
  args: {
    assetRowId: string
    positionId: number
    txHash: string
    refundUnits: bigint
    ledger?: number | null
  },
): Promise<{ status: string; replayed: boolean; lifecycle: string | null }> {
  const { data, error } = await supabase.rpc('rwa_record_refund', {
    p_asset_row_id: args.assetRowId,
    p_position_id: args.positionId,
    p_tx_hash: args.txHash,
    p_refund_units: args.refundUnits.toString(),
    p_ledger: args.ledger ?? null,
  })

  if (error) {
    throw new RwaError(
      rwaCodeFromDatabaseError(error),
      'Could not record the refund',
    )
  }

  const row = (data ?? {}) as Record<string, unknown>
  return {
    status: String(row.status ?? ''),
    replayed: Boolean(row.replayed),
    lifecycle: (row.lifecycle as string | null) ?? null,
  }
}

/** Read the current pool state, including live capacity. */
export async function getAssetState(
  supabase: SupabaseClient,
  assetRowId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('rwa_get_asset_state', {
    p_asset_row_id: assetRowId,
  })

  if (error) throw error
  const row = (data ?? null) as Record<string, unknown> | null
  return row
}

export async function listOpenContributionAttempts(
  supabase: SupabaseClient,
): Promise<Array<{ attempt_id: string; investor_id: string; tx_hash: string }>> {
  const { data, error } = await supabase
    .from('rwa_contributions')
    .select('attempt_id, investor_id, tx_hash, status')
    .in('status', ['submitted'])
    .not('tx_hash', 'is', null)
    .limit(25)
  if (error) throw error
  return (data ?? []).flatMap((row) => {
    const attemptId = String((row as { attempt_id?: string }).attempt_id ?? '')
    const investorId = String((row as { investor_id?: string }).investor_id ?? '')
    const txHash = String((row as { tx_hash?: string }).tx_hash ?? '')
    return attemptId && investorId && txHash
      ? [{ attempt_id: attemptId, investor_id: investorId, tx_hash: txHash }]
      : []
  })
}

export { RWA_ERROR_CODES, RwaError }
