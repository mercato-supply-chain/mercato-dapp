/**
 * The shared RWA contribution intent service.
 *
 * This is the single submission/retry stack for the RWA funding path. Every
 * route (prepare, submit, confirm, status) goes through these functions, so
 * there is exactly one place that decides what a contribution is and what
 * counts as confirmed.
 *
 * The rules enforced here:
 *   * A session alone never authorises a contribution. The investor role, the
 *     registered wallet and the asset snapshot are all resolved server-side.
 *   * A prepared or submitted attempt is not funded principal. Only a
 *     verified on-chain event projected through the protected operation makes
 *     a position count.
 *   * The observed receipt must match the reserved intent exactly.
 *   * A signed amount is never silently reduced: a capacity conflict returns
 *     the current capacity instead.
 */

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RwaConfig } from '@/lib/rwa/config'
import { isValidAssetId, isValidStellarAddress } from '@/lib/rwa/config'
import { selectContributionEvents, type RwaChainReader } from '@/lib/rwa/chain'
import { RWA_ERROR_CODES, RwaError } from '@/lib/rwa/errors'
import { investorCapExceeded } from '@/lib/rwa/bindings'
import { amountToUnits, formatUnits } from '@/lib/rwa/units'
import {
  confirmContribution,
  getAssetByAssetId,
  getAttempt,
  getAssetState,
  getInvestorProfile,
  getPositionForInvestor,
  markAttemptFailed,
  recordSubmission,
  reserveContribution,
  type RwaAssetRow,
  type RwaAttemptRow,
} from '@/lib/rwa/db'
import type {
  ConfirmContributionInput,
  ContributionStatusInput,
  PrepareContributionInput,
  SubmitContributionInput,
} from '@/lib/rwa/schemas'

export type RwaActor = {
  userId: string
  email: string | null
}

export type RwaDependencies = {
  /** Service-role client: the protected RWA operations are not user-callable. */
  supabase: SupabaseClient
  chain: RwaChainReader
  config: RwaConfig
}

/** The contract call the client is expected to sign. */
export type RwaIntendedCall = {
  contractId: string
  functionName: 'contribute'
  args: {
    investor: string
    principalUnits: string
    nonce: string
    contributionRef: string
  }
}

export type PrepareContributionResult = {
  attemptId: string
  status: string
  nonce: number
  contributionRef: string
  principalUnits: string
  assetId: string
  network: string
  fundingPoolContractId: string
  tokenContractId: string
  tokenDecimals: number
  investorAddress: string
  reservationExpiresAt: string | null
  replayed: boolean
  call: RwaIntendedCall
}

export type ConfirmContributionResult = {
  attemptId: string
  status: 'confirmed'
  replayed: boolean
  receiptId: string
  eventIndex: number
  positionId: number
  principalUnits: string
  ownershipUnits: string
  fundingFeeUnits: string
  contributionCount: number
  /** True when this contribution completed the funding target. */
  targetReached: boolean
  lifecycle: string | null
  /**
   * A confirmed contribution counts towards funded principal. Attempts that
   * are only prepared or submitted do not, and never report this as true.
   */
  countsAsFundedPrincipal: boolean
}

export type ContributionStatusResult = {
  attemptId: string
  status: string
  network: string
  assetId: string
  investorAddress: string
  principalUnits: string
  nonce: number
  contributionRef: string
  txHash: string | null
  receiptId: string | null
  confirmedAt: string | null
  failureCode: string | null
  /** True when the attempt counts towards funded principal. */
  countsAsFundedPrincipal: boolean
}

function normalizeAddress(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (!isValidStellarAddress(trimmed)) return null
  return trimmed.toUpperCase()
}

/**
 * Resolve the wallet the investor is allowed to sign with.
 *
 * The wallet must be registered on the profile. A session on its own proves
 * nothing about a submitted address.
 */
export function resolveAuthorizedWallet(
  profile: {
    address?: string | null
    stellar_public_key?: string | null
  } | null,
  requestedWallet: string,
): string {
  const requested = normalizeAddress(requestedWallet)
  if (!requested) {
    throw new RwaError(
      RWA_ERROR_CODES.INVALID_REQUEST,
      'A valid Stellar wallet address is required',
    )
  }

  const registered = [
    normalizeAddress(profile?.address),
    normalizeAddress(profile?.stellar_public_key),
  ].filter((value): value is string => value !== null)

  if (registered.length === 0) {
    throw new RwaError(
      RWA_ERROR_CODES.WALLET_NOT_AUTHORIZED,
      'No Stellar wallet is registered for this account',
    )
  }

  if (!registered.includes(requested)) {
    throw new RwaError(
      RWA_ERROR_CODES.WALLET_NOT_AUTHORIZED,
      'The wallet is not registered for this account',
    )
  }

  return requested
}

/** Load and validate the asset snapshot for a contribution. */
async function loadOpenAsset(
  supabase: SupabaseClient,
  config: RwaConfig,
  assetId: string,
): Promise<RwaAssetRow> {
  if (!isValidAssetId(assetId)) {
    throw new RwaError(RWA_ERROR_CODES.INVALID_REQUEST, 'Invalid asset id')
  }

  const asset = await getAssetByAssetId(supabase, config.network, assetId.toLowerCase())
  if (!asset) {
    throw new RwaError(RWA_ERROR_CODES.ASSET_NOT_FOUND, 'Unknown funding asset')
  }

  if (asset.network !== config.network) {
    throw new RwaError(
      RWA_ERROR_CODES.WRONG_NETWORK,
      'The asset belongs to a different network',
    )
  }

  if (asset.lifecycle !== 'open') {
    throw new RwaError(
      RWA_ERROR_CODES.ASSET_NOT_OPEN,
      `The asset is not accepting contributions (${asset.lifecycle})`,
    )
  }

  // The pool freezes its token on chain, so a database row that claims a
  // different token would make the server compute the wrong principal. The
  // check only applies when the deployment pins the expected token.
  if (
    config.usdcSacAddress &&
    asset.token_contract_id.trim().toUpperCase() !==
      config.usdcSacAddress.trim().toUpperCase()
  ) {
    throw new RwaError(
      RWA_ERROR_CODES.WRONG_TOKEN,
      'The asset is not denominated in the expected token',
    )
  }

  if (new Date(asset.deadline_at).getTime() <= Date.now()) {
    throw new RwaError(
      RWA_ERROR_CODES.FUNDING_EXPIRED,
      'The funding deadline for this asset has passed',
    )
  }

  return asset
}

/** Load the attempt and make sure it belongs to the actor. */
async function loadOwnedAttempt(
  supabase: SupabaseClient,
  actor: RwaActor,
  attemptId: string,
): Promise<RwaAttemptRow> {
  const attempt = await getAttempt(supabase, attemptId)
  if (!attempt || attempt.investor_id !== actor.userId) {
    throw new RwaError(
      RWA_ERROR_CODES.ATTEMPT_NOT_FOUND,
      'Unknown contribution attempt',
    )
  }
  return attempt
}

/**
 * Prepare a contribution.
 *
 * Reserves capacity, allocates the nonce and contribution reference, and
 * returns the contract call the investor is expected to sign. The client never
 * chooses the nonce or the reference.
 */
export async function prepareContribution(
  deps: RwaDependencies,
  actor: RwaActor,
  input: PrepareContributionInput,
): Promise<PrepareContributionResult> {
  const { supabase, config } = deps

  const profile = await getInvestorProfile(supabase, actor.userId)
  if (!profile || profile.user_type !== 'investor') {
    throw new RwaError(
      RWA_ERROR_CODES.FORBIDDEN,
      'Only investors can contribute to a funding pool',
    )
  }

  const walletAddress = resolveAuthorizedWallet(profile, input.walletAddress)
  const asset = await loadOpenAsset(supabase, config, input.assetId)

  const amount = typeof input.amount === 'string' ? Number(input.amount) : input.amount
  let principalUnits: bigint
  try {
    principalUnits = amountToUnits(amount, asset.token_decimals)
  } catch (error) {
    throw new RwaError(
      RWA_ERROR_CODES.INVALID_AMOUNT,
      error instanceof Error ? error.message : 'Invalid amount',
    )
  }

  // The wallet an investor uses for an asset is bound on the first
  // contribution: the contract keys positions by address, so switching wallets
  // would create a second on-chain position for the same investor.
  const existingPosition = await getPositionForInvestor(
    supabase,
    asset.network,
    asset.asset_id,
    actor.userId,
  )
  if (
    existingPosition &&
    normalizeAddress(existingPosition.investor_address) !== walletAddress
  ) {
    throw new RwaError(
      RWA_ERROR_CODES.WALLET_NOT_AUTHORIZED,
      'A different wallet is already bound to this funding position',
    )
  }

  if (investorCapExceeded(asset.position_count, Boolean(existingPosition))) {
    throw new RwaError(
      RWA_ERROR_CODES.INSUFFICIENT_CAPACITY,
      'This financing already has the maximum number of investors',
    )
  }

  const reservation = await reserveContribution(supabase, {
    attemptId: randomUUID(),
    idempotencyKey: input.idempotencyKey,
    assetRowId: asset.id,
    investorId: actor.userId,
    investorAddress: walletAddress,
    principalUnits,
  })

  return {
    attemptId: reservation.attempt_id,
    status: reservation.status,
    nonce: reservation.nonce,
    contributionRef: reservation.contribution_ref,
    principalUnits: reservation.principal_units.toString(),
    assetId: reservation.asset_id,
    network: reservation.network,
    fundingPoolContractId: reservation.funding_pool_contract_id,
    tokenContractId: asset.token_contract_id,
    tokenDecimals: asset.token_decimals,
    investorAddress: reservation.investor_address,
    reservationExpiresAt: reservation.reservation_expires_at,
    replayed: reservation.replayed,
    call: {
      contractId: reservation.funding_pool_contract_id,
      functionName: 'contribute',
      args: {
        investor: reservation.investor_address,
        principalUnits: reservation.principal_units.toString(),
        nonce: reservation.nonce.toString(),
        contributionRef: reservation.contribution_ref,
      },
    },
  }
}

/**
 * Record that the client submitted the transaction.
 *
 * Nothing is confirmed here. The hash is only a pointer to the chain.
 */
export async function submitContribution(
  deps: RwaDependencies,
  actor: RwaActor,
  input: SubmitContributionInput,
): Promise<{ attemptId: string; status: string }> {
  const { supabase } = deps
  const attempt = await loadOwnedAttempt(supabase, actor, input.attemptId)

  if (attempt.status === 'confirmed') {
    return { attemptId: attempt.attempt_id, status: 'confirmed' }
  }

  await recordSubmission(supabase, {
    attemptId: input.attemptId,
    txHash: input.txHash.toLowerCase(),
  })

  return { attemptId: attempt.attempt_id, status: 'submitted' }
}

/**
 * Confirm a contribution by verifying the chain and projecting the result.
 *
 * The transaction must have succeeded and the funding contract must have
 * emitted a contribution event whose values match the reserved intent. Only
 * then is the projection written, and the write goes through the protected
 * operation so a duplicate receipt cannot double count.
 */
export async function confirmContributionIntent(
  deps: RwaDependencies,
  actor: RwaActor,
  input: ConfirmContributionInput,
): Promise<ConfirmContributionResult> {
  const { supabase, chain, config } = deps
  const attempt = await loadOwnedAttempt(supabase, actor, input.attemptId)
  const txHash = input.txHash.toLowerCase()

  if (attempt.status === 'confirmed') {
    // Already projected: return the stored projection rather than re-verifying,
    // so a repeated confirm is a cheap no-op.
    const position = await getPositionForInvestor(
      supabase,
      attempt.network,
      attempt.asset_id,
      actor.userId,
    )
    return {
      attemptId: attempt.attempt_id,
      status: 'confirmed',
      replayed: true,
      receiptId: attempt.receipt_id ?? '',
      eventIndex: 0,
      positionId: position?.position_id ?? 0,
      principalUnits: String(position?.principal_units ?? 0),
      ownershipUnits: String(position?.ownership_units ?? 0),
      fundingFeeUnits: String(position?.funding_fee_units ?? 0),
      contributionCount: position?.contribution_count ?? 0,
      targetReached: false,
      lifecycle: null,
      countsAsFundedPrincipal: true,
    }
  }

  if (attempt.tx_hash && attempt.tx_hash.toLowerCase() !== txHash) {
    throw new RwaError(
      RWA_ERROR_CODES.RECEIPT_MISMATCH,
      'The transaction does not match the submitted contribution',
    )
  }

  const networkPassphrase = await chain.getNetworkPassphrase()
  if (networkPassphrase && networkPassphrase !== config.networkPassphrase) {
    throw new RwaError(
      RWA_ERROR_CODES.WRONG_NETWORK,
      'The chain reader is connected to a different network',
    )
  }

  const transaction = await chain.getTransaction(txHash)
  if (!transaction) {
    throw new RwaError(
      RWA_ERROR_CODES.TRANSACTION_NOT_FOUND,
      'The transaction was not found on the network',
    )
  }
  if (!transaction.successful) {
    throw new RwaError(
      RWA_ERROR_CODES.TRANSACTION_FAILED,
      'The transaction did not succeed on the network',
    )
  }

  const rawEvents = await chain.getContractEvents(
    attempt.funding_pool_contract_id,
    txHash,
  )
  const events = selectContributionEvents(rawEvents)
  if (events.length === 0) {
    throw new RwaError(
      RWA_ERROR_CODES.EVENT_NOT_FOUND,
      'The transaction did not produce a funding contribution event',
    )
  }

  // The event must describe the reserved intent exactly. A transaction that
  // is valid but unrelated produces an event with different values and is
  // rejected here.
  const event = events.find(
    (candidate) =>
      candidate.contractId.toUpperCase() ===
        attempt.funding_pool_contract_id.toUpperCase() &&
      candidate.assetId.toLowerCase() === attempt.asset_id.toLowerCase() &&
      candidate.investorAddress.toUpperCase() ===
        attempt.investor_address.toUpperCase() &&
      candidate.nonce === BigInt(attempt.nonce) &&
      candidate.contributionRef.toLowerCase() ===
        attempt.contribution_ref.toLowerCase() &&
      candidate.principalUnits === BigInt(attempt.principal_units),
  )

  if (!event) {
    throw new RwaError(
      RWA_ERROR_CODES.RECEIPT_MISMATCH,
      'The on-chain contribution does not match the reserved intent',
    )
  }

  const receiptId = `${txHash}:${event.eventId}`
  const projection = await confirmContribution(supabase, {
    attemptId: attempt.attempt_id,
    txHash,
    receiptId,
    eventIndex: event.eventIndex,
    ledger: transaction.ledger,
    investorAddress: event.investorAddress,
    principalUnits: event.principalUnits,
    fundingFeeUnits: event.fundingFeeUnits,
    ownershipUnits: event.ownershipUnits,
    nonce: event.nonce,
    contributionRef: event.contributionRef,
    positionId: event.positionId,
  })

  return {
    attemptId: attempt.attempt_id,
    status: 'confirmed',
    replayed: projection.replayed,
    receiptId: receiptId,
    eventIndex: event.eventIndex,
    positionId: projection.position_id ?? event.positionId,
    principalUnits: String(projection.principal_units ?? event.principalUnits),
    ownershipUnits: String(projection.ownership_units ?? event.ownershipUnits),
    fundingFeeUnits: String(projection.funding_fee_units ?? event.fundingFeeUnits),
    contributionCount: projection.contribution_count ?? 1,
    targetReached: projection.target_reached ?? false,
    lifecycle: projection.lifecycle,
    countsAsFundedPrincipal: true,
  }
}

/**
 * Report the state of a contribution attempt.
 *
 * Only confirmed attempts count as funded principal. A prepared, submitted or
 * expired attempt is explicitly reported as contributing zero, so a client
 * cannot mistake an in-flight attempt for funding.
 */
export async function getContributionStatus(
  deps: RwaDependencies,
  actor: RwaActor,
  input: ContributionStatusInput,
): Promise<ContributionStatusResult[]> {
  const { supabase, config } = deps

  if (input.attemptId) {
    const attempt = await loadOwnedAttempt(supabase, actor, input.attemptId)
    return [toStatusResult(attempt)]
  }

  if (!input.assetId) {
    throw new RwaError(
      RWA_ERROR_CODES.INVALID_REQUEST,
      'An attempt id or asset id is required',
    )
  }

  const asset = await getAssetByAssetId(
    supabase,
    config.network,
    input.assetId.toLowerCase(),
  )
  if (!asset) {
    throw new RwaError(RWA_ERROR_CODES.ASSET_NOT_FOUND, 'Unknown funding asset')
  }

  const { data, error } = await supabase
    .from('rwa_contributions')
    .select(
      'id, attempt_id, idempotency_key, asset_row_id, network, asset_id, funding_pool_contract_id, investor_id, investor_address, principal_units, nonce, contribution_ref, status, tx_hash, receipt_id, ledger, reservation_expires_at, confirmed_at, failure_code',
    )
    .eq('network', asset.network)
    .eq('asset_id', asset.asset_id)
    .eq('investor_id', actor.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return ((data ?? []) as RwaAttemptRow[]).map(toStatusResult)
}

function toStatusResult(attempt: RwaAttemptRow): ContributionStatusResult {
  return {
    attemptId: attempt.attempt_id,
    status: attempt.status,
    network: attempt.network,
    assetId: attempt.asset_id,
    investorAddress: attempt.investor_address,
    principalUnits: String(attempt.principal_units),
    nonce: attempt.nonce,
    contributionRef: attempt.contribution_ref,
    txHash: attempt.tx_hash,
    receiptId: attempt.receipt_id,
    confirmedAt: attempt.confirmed_at,
    failureCode: attempt.failure_code,
    // Only a confirmed contribution is funded principal.
    countsAsFundedPrincipal: attempt.status === 'confirmed',
  }
}

/**
 * Mark an attempt as failed after a definitive on-chain failure.
 *
 * This never downgrades a confirmed contribution: the protected operation
 * ignores the request for a confirmed attempt.
 */
export async function failContribution(
  deps: RwaDependencies,
  actor: RwaActor,
  attemptId: string,
  failureCode: string,
): Promise<void> {
  const attempt = await loadOwnedAttempt(deps.supabase, actor, attemptId)
  if (attempt.status === 'confirmed') return
  await markAttemptFailed(deps.supabase, attemptId, failureCode)
}

/** Read the current pool state for an asset, including live capacity. */
export async function getPoolState(
  deps: RwaDependencies,
  assetId: string,
): Promise<Record<string, unknown> | null> {
  const { supabase, config } = deps
  if (!isValidAssetId(assetId)) {
    throw new RwaError(RWA_ERROR_CODES.INVALID_REQUEST, 'Invalid asset id')
  }
  const asset = await getAssetByAssetId(
    supabase,
    config.network,
    assetId.toLowerCase(),
  )
  if (!asset) {
    throw new RwaError(RWA_ERROR_CODES.ASSET_NOT_FOUND, 'Unknown funding asset')
  }
  return getAssetState(supabase, asset.id)
}

/** Format base units for the API response. */
export { formatUnits }
