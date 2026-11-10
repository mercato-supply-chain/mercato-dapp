/**
 * Admin issuance of one credit asset and its funding pool.
 *
 * Prepare stores the unsigned transaction before anyone signs it. Submit checks
 * that signature against the stored envelope. Status re-reads the ledger and
 * only then writes the credit asset and the pool row the contribution API uses.
 * Repeating any step for the same deal and idempotency key returns the same
 * asset id.
 */

import { Address, Contract, rpc, TransactionBuilder, xdr } from '@stellar/stellar-sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addressVal,
  buildAssembledSorobanInvoke,
  bytes32,
  scSymbolMap,
  submitSorobanEnvelope,
} from '@/lib/stellar/build-soroban-invoke'
import { nativeToScVal } from '@stellar/stellar-sdk'
import { getStellarNetworkConfig } from '@/lib/stellar/network-config'
import {
  buildFinancialSnapshot,
  hashFinancialSnapshot,
  type RwaFinancialSnapshot,
} from '@/lib/rwa/commitment'
import { getRwaConfig, isValidAssetId, isValidContractId, type RwaConfig } from '@/lib/rwa/config'
import { RWA_ERROR_CODES, RwaError } from '@/lib/rwa/errors'
import { assetIdForDeal, dealHash, documentRoot } from '@/lib/rwa/bindings'
import { validateSignedTransactionIntent } from '@/lib/rwa/transaction-intents'
import { PLATFORM_FEE_PERCENT, TW_PROTOCOL_FEE_PERCENT } from '@/lib/deals/fees'

export const RWA_ISSUANCE_PHASE = {
  register: 'register_asset',
  pool: 'create_funding_pool',
} as const

export type IssuancePhase = (typeof RWA_ISSUANCE_PHASE)[keyof typeof RWA_ISSUANCE_PHASE]

export type IssuanceDocumentInput = {
  kind: string
  contentHash: string
  opaqueRef?: string
  byteLength?: number
}

export type PrepareIssuanceInput = {
  dealId: string
  idempotencyKey: string
  signingWallet: string
  documents: IssuanceDocumentInput[]
}

type AttemptRow = {
  id: string
  deal_id: string
  idempotency_key: string
  network: string
  registry_contract: string
  asset_id: string
  deal_hash: string
  snapshot_hash: string
  document_root: string
  phase: IssuancePhase
  status: string
  unsigned_xdr: string
  signing_wallet: string
  tx_hash: string | null
  pool_contract_id: string | null
  credit_asset_id: string | null
  payload: Record<string, unknown>
}

export type IssuanceView = {
  attemptId: string
  phase: IssuancePhase
  status: string
  assetId: string
  dealHash: string
  snapshotHash: string
  documentRoot: string
  unsignedXdr: string | null
  txHash: string | null
  poolContractId: string | null
  creditAssetId: string | null
  replayed: boolean
}

type DealIssuanceRow = {
  id: string
  amount: number
  interest_rate: number
  term_days: number
  status: string
  rwa_opted_in: boolean
  investor_id: string | null
  funded_at: string | null
  supplier_id: string | null
  escrow_contract_address: string | null
  funding_expires_at: string | null
  pyme_id: string
}

export type IssuanceDeps = {
  supabase: SupabaseClient
  config: RwaConfig
  actorId: string
}

const ATTEMPT_COLUMNS =
  'id, deal_id, idempotency_key, network, registry_contract, asset_id, deal_hash, snapshot_hash, document_root, phase, status, unsigned_xdr, signing_wallet, tx_hash, pool_contract_id, credit_asset_id, payload'

function view(row: AttemptRow, replayed: boolean): IssuanceView {
  return {
    attemptId: row.id,
    phase: row.phase,
    status: row.status,
    assetId: row.asset_id,
    dealHash: row.deal_hash,
    snapshotHash: row.snapshot_hash,
    documentRoot: row.document_root,
    unsignedXdr: row.status === 'prepared' ? row.unsigned_xdr : null,
    txHash: row.tx_hash,
    poolContractId: row.pool_contract_id,
    creditAssetId: row.credit_asset_id,
    replayed,
  }
}

function requireEnabled(config: RwaConfig): void {
  if (!config.enabled) {
    throw new RwaError(RWA_ERROR_CODES.ASSET_NOT_OPEN, 'RWA issuance is disabled')
  }
  if (!config.registryContractId || !isValidContractId(config.registryContractId)) {
    throw new RwaError(RWA_ERROR_CODES.WRONG_CONTRACT, 'RWA registry contract is not configured')
  }
  if (!config.usdcSacAddress || !isValidContractId(config.usdcSacAddress)) {
    throw new RwaError(RWA_ERROR_CODES.WRONG_TOKEN, 'RWA USDC SAC is not configured')
  }
  if (!config.platformAddress) {
    throw new RwaError(RWA_ERROR_CODES.INVALID_REQUEST, 'Platform address is not configured')
  }
}

function interestRatio(aprPercent: number, termDays: number): { numerator: bigint; denominator: bigint } {
  const bps = BigInt(Math.round(aprPercent * 100))
  const numerator = bps * BigInt(termDays)
  const denominator = BigInt(365) * BigInt(10_000)
  if (numerator <= BigInt(0) || numerator >= denominator) {
    throw new RwaError(RWA_ERROR_CODES.INVALID_REQUEST, 'Deal yield does not fit the frozen return ratio')
  }
  return { numerator, denominator }
}

async function loadDeal(supabase: SupabaseClient, dealId: string): Promise<DealIssuanceRow> {
  const { data, error } = await supabase
    .from('deals')
    .select(
      'id, amount, interest_rate, term_days, status, rwa_opted_in, investor_id, funded_at, supplier_id, escrow_contract_address, funding_expires_at, pyme_id',
    )
    .eq('id', dealId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new RwaError(RWA_ERROR_CODES.ASSET_NOT_FOUND, 'Deal not found')
  return data as DealIssuanceRow
}

async function assertEligible(supabase: SupabaseClient, deal: DealIssuanceRow): Promise<string> {
  if (!deal.rwa_opted_in) {
    throw new RwaError(RWA_ERROR_CODES.INVALID_REQUEST, 'Deal is not opted into RWA')
  }
  if (deal.status === 'cancelled' || deal.investor_id || deal.funded_at) {
    throw new RwaError(RWA_ERROR_CODES.ASSET_NOT_OPEN, 'Deal is not eligible for issuance')
  }
  if (!deal.supplier_id || !deal.escrow_contract_address) {
    throw new RwaError(
      RWA_ERROR_CODES.INVALID_REQUEST,
      'Deal needs a verified supplier and a repayment escrow before issuance',
    )
  }
  const [{ data: pyme }, { data: supplier }] = await Promise.all([
    supabase.from('profiles').select('verified').eq('id', deal.pyme_id).maybeSingle(),
    supabase.from('supplier_companies').select('verified, address').eq('id', deal.supplier_id).maybeSingle(),
  ])
  if (!pyme?.verified || !supplier?.verified || !supplier.address) {
    throw new RwaError(RWA_ERROR_CODES.FORBIDDEN, 'PyME and supplier must be verified, with a supplier wallet')
  }
  return String(supplier.address)
}

async function findAttempt(
  supabase: SupabaseClient,
  dealId: string,
  idempotencyKey: string,
  phase: IssuancePhase,
): Promise<AttemptRow | null> {
  const { data, error } = await supabase
    .from('rwa_issuance_attempts')
    .select(ATTEMPT_COLUMNS)
    .eq('deal_id', dealId)
    .eq('idempotency_key', idempotencyKey)
    .eq('phase', phase)
    .maybeSingle()
  if (error) throw error
  return (data as AttemptRow | null) ?? null
}

async function getAttempt(supabase: SupabaseClient, attemptId: string): Promise<AttemptRow> {
  const { data, error } = await supabase
    .from('rwa_issuance_attempts')
    .select(ATTEMPT_COLUMNS)
    .eq('id', attemptId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new RwaError(RWA_ERROR_CODES.ATTEMPT_NOT_FOUND, 'Unknown issuance attempt')
  return data as AttemptRow
}

function registerArgs(
  assetId: string,
  terms: {
    token: string
    tokenDecimals: number
    targetPrincipal: string
    supplier: string
    feeRecipient: string
    excessRecipient: string
    fundingFeeBps: number
    feePolicyVersion: number
    deadline: string
    dealHash: string
    snapshotHash: string
    documentRoot: string
  },
): xdr.ScVal[] {
  return [
    bytes32(assetId),
    scSymbolMap([
      ['token', addressVal(terms.token)],
      ['token_decimals', nativeToScVal(terms.tokenDecimals, { type: 'u32' })],
      ['target_principal', nativeToScVal(terms.targetPrincipal, { type: 'i128' })],
      ['supplier', addressVal(terms.supplier)],
      ['fee_recipient', addressVal(terms.feeRecipient)],
      ['excess_recipient', addressVal(terms.excessRecipient)],
      ['funding_fee_bps', nativeToScVal(terms.fundingFeeBps, { type: 'u32' })],
      ['fee_policy_version', nativeToScVal(terms.feePolicyVersion, { type: 'u32' })],
      ['deadline', nativeToScVal(String(terms.deadline), { type: 'u64' })],
      ['deal_hash', bytes32(String(terms.dealHash))],
      ['snapshot_hash', bytes32(String(terms.snapshotHash))],
      ['document_root', bytes32(String(terms.documentRoot))],
    ]),
  ]
}

export async function prepareIssuance(
  deps: IssuanceDeps,
  input: PrepareIssuanceInput,
): Promise<IssuanceView> {
  requireEnabled(deps.config)
  const existing = await findAttempt(
    deps.supabase,
    input.dealId,
    input.idempotencyKey,
    RWA_ISSUANCE_PHASE.register,
  )
  if (existing && existing.status !== 'failed') return view(existing, true)

  const signingWallet = input.signingWallet.trim()
  if (
    deps.config.registryAdminAddress &&
    signingWallet !== deps.config.registryAdminAddress
  ) {
    throw new RwaError(RWA_ERROR_CODES.FORBIDDEN, 'Signing wallet is not the registry admin')
  }

  const deal = await loadDeal(deps.supabase, input.dealId)
  const supplier = await assertEligible(deps.supabase, deal)
  const network = deps.config.network
  const registry = deps.config.registryContractId as string
  const assetId = assetIdForDeal(network, registry, deal.id)
  const boundDeal = dealHash(deal.id)
  const root = documentRoot(input.documents.map((document) => document.contentHash))
  const ratio = interestRatio(Number(deal.interest_rate), Number(deal.term_days))
  const decimals = 7
  const principal = BigInt(Math.round(Number(deal.amount) * 10 ** decimals))
  const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
  const identity = `${network}:${registry}:${assetId}`
  const snapshot = buildFinancialSnapshot({
    snapshot_version: 1,
    deal_id: deal.id,
    network,
    asset_code: 'USDC',
    asset_issuer: deps.config.usdcIssuer ?? (deps.config.usdcSacAddress as string),
    asset_decimals: decimals,
    principal_atomic: principal.toString(),
    return_numerator: ratio.numerator.toString(),
    return_denominator: ratio.denominator.toString(),
    display_yield_bps: Math.round(Number(deal.interest_rate) * 100),
    term_days: Number(deal.term_days),
    maturity_policy: 'delivery_relative',
    fees: {
      platform_fee_bps: Math.round(PLATFORM_FEE_PERCENT * 100),
      tw_fee_bps: Math.round(TW_PROTOCOL_FEE_PERCENT * 100),
      rounding_policy: 'half_up_atomic',
      charged_at: 'funding',
    },
    issued_at: issuedAt,
    issuance_identity: identity,
  } satisfies RwaFinancialSnapshot)
  const snapshotHash = hashFinancialSnapshot(snapshot)
  const deadline = deal.funding_expires_at
    ? Math.floor(new Date(deal.funding_expires_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60
  const platformAddress = deps.config.platformAddress
  const token = deps.config.usdcSacAddress
  if (!platformAddress || !token) {
    throw new RwaError(RWA_ERROR_CODES.INVALID_REQUEST, 'Platform address or USDC SAC is not configured')
  }
  const terms = {
    token,
    tokenDecimals: decimals,
    targetPrincipal: principal.toString(),
    supplier,
    feeRecipient: platformAddress,
    excessRecipient: platformAddress,
    fundingFeeBps: Math.round(PLATFORM_FEE_PERCENT * 100),
    feePolicyVersion: 1,
    deadline: String(deadline),
    dealHash: boundDeal,
    snapshotHash,
    documentRoot: root,
  }
  const unsignedXdr = await buildAssembledSorobanInvoke({
    sourceAddress: signingWallet,
    contractId: registry,
    functionName: 'register_asset',
    args: registerArgs(assetId, terms),
    network,
    rpcUrl: deps.config.rpcUrl,
  })
  const payload = {
    snapshot,
    snapshotHash,
    documents: input.documents,
    terms,
    principal: principal.toString(),
    returnNumerator: ratio.numerator.toString(),
    returnDenominator: ratio.denominator.toString(),
    displayYieldBps: Math.round(Number(deal.interest_rate) * 100),
    termDays: Number(deal.term_days),
  }
  const { data, error } = await deps.supabase
    .from('rwa_issuance_attempts')
    .upsert(
      {
        deal_id: deal.id,
        idempotency_key: input.idempotencyKey,
        network,
        registry_contract: registry,
        asset_id: assetId,
        deal_hash: boundDeal,
        snapshot_hash: snapshotHash,
        document_root: root,
        phase: RWA_ISSUANCE_PHASE.register,
        status: 'prepared',
        unsigned_xdr: unsignedXdr,
        signing_wallet: signingWallet,
        payload,
        failure_code: null,
      },
      { onConflict: 'deal_id,idempotency_key,phase' },
    )
    .select(ATTEMPT_COLUMNS)
    .single()
  if (error) throw error
  return view(data as AttemptRow, false)
}

export async function submitIssuance(
  deps: IssuanceDeps,
  input: { attemptId: string; signedXdr: string },
): Promise<IssuanceView> {
  const attempt = await getAttempt(deps.supabase, input.attemptId)
  if (attempt.status === 'confirmed' || attempt.status === 'submitted') {
    return view(attempt, true)
  }
  validateSignedTransactionIntent(input.signedXdr, {
    unsignedXdr: attempt.unsigned_xdr,
    signingWallet: attempt.signing_wallet,
    network: attempt.network === 'mainnet' ? 'mainnet' : 'testnet',
  })
  const sent = await submitSorobanEnvelope(
    input.signedXdr,
    attempt.network === 'mainnet' ? 'mainnet' : 'testnet',
    deps.config.rpcUrl,
  )
  const { data, error } = await deps.supabase
    .from('rwa_issuance_attempts')
    .update({
      status: sent.status === 'ERROR' ? 'failed' : 'submitted',
      tx_hash: sent.hash,
      failure_code: sent.status === 'ERROR' ? 'submit_rejected' : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attempt.id)
    .select(ATTEMPT_COLUMNS)
    .single()
  if (error) throw error
  return view(data as AttemptRow, false)
}

type TxLookup = {
  status: 'missing' | 'pending' | 'success' | 'failed'
  ledger: number | null
}

async function lookupTransaction(config: RwaConfig, network: 'testnet' | 'mainnet', hash: string): Promise<TxLookup> {
  const server = new rpc.Server(config.rpcUrl)
  const response = await server.getTransaction(hash)
  if (response.status === 'NOT_FOUND') return { status: 'missing', ledger: null }
  if (response.status === 'SUCCESS') return { status: 'success', ledger: response.ledger }
  if (response.status === 'FAILED') return { status: 'failed', ledger: response.ledger ?? null }
  return { status: 'pending', ledger: null }
}

function mapOf(value: xdr.ScVal | null | undefined): Map<string, xdr.ScVal> {
  const map = new Map<string, xdr.ScVal>()
  if (!value || value.switch().name !== 'scvMap') return map
  for (const entry of value.map() ?? []) {
    const key = entry.key()
    if (key.switch().name === 'scvSymbol') map.set(key.sym().toString(), entry.val())
  }
  return map
}

async function readRegisteredAsset(
  config: RwaConfig,
  registry: string,
  assetId: string,
  source: string,
): Promise<{ snapshotHash: string; dealHash: string; pool: string | null }> {
  const network = config.network
  const { rpcUrl, networkPassphrase } = getStellarNetworkConfig(network)
  const server = new rpc.Server(config.rpcUrl || rpcUrl)
  const account = await server.getAccount(source)
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase })
    .addOperation(new Contract(registry).call('get_asset', bytes32(assetId)))
    .setTimeout(60)
    .build()
  const simulated = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulated) || !simulated.result?.retval) {
    throw new RwaError(RWA_ERROR_CODES.STATE_UNAVAILABLE, 'Registry readback failed')
  }
  const record = mapOf(simulated.result.retval)
  const terms = mapOf(record.get('terms'))
  const snapshot = terms.get('snapshot_hash')
  const deal = terms.get('deal_hash')
  if (!snapshot || snapshot.switch().name !== 'scvBytes' || !deal || deal.switch().name !== 'scvBytes') {
    throw new RwaError(RWA_ERROR_CODES.RECEIPT_MISMATCH, 'Registry asset is missing its commitment hashes')
  }
  const poolVal = record.get('funding_pool')
  const pool =
    poolVal && poolVal.switch().name === 'scvAddress' ? Address.fromScVal(poolVal).toString() : null
  return {
    snapshotHash: Buffer.from(snapshot.bytes()).toString('hex'),
    dealHash: Buffer.from(deal.bytes()).toString('hex'),
    pool,
  }
}

async function commitPool(deps: IssuanceDeps, register: AttemptRow, poolContractId: string, ledger: number | null) {
  const payload = register.payload
  const terms = payload.terms as Record<string, string>
  const snapshot = payload.snapshot as RwaFinancialSnapshot
  const documents = (payload.documents as IssuanceDocumentInput[]).map((document) => ({
    kind: document.kind,
    content_hash: document.contentHash,
    opaque_ref: document.opaqueRef ?? null,
    byte_length: document.byteLength ?? null,
  }))
  const { data, error } = await deps.supabase.rpc('rwa_commit_verified_issuance', {
    p_actor_id: deps.actorId,
    p_deal_id: register.deal_id,
    p_network: register.network,
    p_registry_contract: register.registry_contract,
    p_asset_id: register.asset_id,
    p_asset_code: 'USDC',
    p_asset_issuer: snapshot.asset_issuer,
    p_asset_decimals: 7,
    p_principal_atomic: payload.principal,
    p_return_numerator: payload.returnNumerator,
    p_return_denominator: payload.returnDenominator,
    p_display_yield_bps: payload.displayYieldBps,
    p_term_days: payload.termDays,
    p_fees: snapshot.fees,
    p_financial_snapshot: snapshot,
    p_financial_snapshot_hash: register.snapshot_hash,
    p_issuance_receipt_tx: register.tx_hash,
    p_issuance_operation_id: 'register_asset',
    p_issuance_ledger_seq: ledger ?? 1,
    p_documents: documents,
    p_pool_contract_id: poolContractId,
    p_token_contract_id: terms.token,
    p_supplier_address: terms.supplier,
    p_fee_recipient_address: terms.feeRecipient,
    p_excess_recipient_address: terms.excessRecipient,
    p_funding_fee_bps: Number(terms.fundingFeeBps),
    p_fee_policy_version: Number(terms.feePolicyVersion),
    p_deadline_at: new Date(Number(terms.deadline) * 1000).toISOString(),
  })
  if (error) {
    throw new RwaError(RWA_ERROR_CODES.INTERNAL, error.message)
  }
  return String(data)
}

export async function reconcileIssuance(deps: IssuanceDeps, attemptId: string): Promise<IssuanceView> {
  const attempt = await getAttempt(deps.supabase, attemptId)
  if (attempt.status === 'confirmed' && attempt.phase === RWA_ISSUANCE_PHASE.pool) {
    return view(attempt, true)
  }
  if (attempt.status === 'prepared') return view(attempt, true)
  if (!attempt.tx_hash) {
    throw new RwaError(RWA_ERROR_CODES.TRANSACTION_NOT_FOUND, 'Issuance attempt has no transaction')
  }
  const network = attempt.network === 'mainnet' ? 'mainnet' : 'testnet'
  const lookup = await lookupTransaction(deps.config, network, attempt.tx_hash)
  if (lookup.status === 'missing' || lookup.status === 'pending') {
    await deps.supabase
      .from('rwa_issuance_attempts')
      .update({ status: 'unknown', updated_at: new Date().toISOString() })
      .eq('id', attempt.id)
      .in('status', ['submitted', 'unknown'])
    return view({ ...attempt, status: 'unknown' }, false)
  }
  if (lookup.status === 'failed') {
    await deps.supabase
      .from('rwa_issuance_attempts')
      .update({ status: 'failed', failure_code: 'transaction_failed', updated_at: new Date().toISOString() })
      .eq('id', attempt.id)
    return view({ ...attempt, status: 'failed' }, false)
  }

  const readback = await readRegisteredAsset(
    deps.config,
    attempt.registry_contract,
    attempt.asset_id,
    attempt.signing_wallet,
  )
  if (readback.snapshotHash !== attempt.snapshot_hash || readback.dealHash !== attempt.deal_hash) {
    throw new RwaError(RWA_ERROR_CODES.RECEIPT_MISMATCH, 'On-chain commitments do not match the reviewed issuance')
  }

  if (attempt.phase === RWA_ISSUANCE_PHASE.register) {
    await deps.supabase
      .from('rwa_issuance_attempts')
      .update({ status: 'confirmed', ledger_seq: lookup.ledger, updated_at: new Date().toISOString() })
      .eq('id', attempt.id)
    const poolAttempt = await ensurePoolAttempt(deps, { ...attempt, status: 'confirmed' })
    return view(poolAttempt, false)
  }

  if (!readback.pool) {
    throw new RwaError(RWA_ERROR_CODES.STATE_UNAVAILABLE, 'Funding pool is not on the registry record yet')
  }
  const register = await findAttempt(
    deps.supabase,
    attempt.deal_id,
    attempt.idempotency_key,
    RWA_ISSUANCE_PHASE.register,
  )
  if (!register) throw new RwaError(RWA_ERROR_CODES.ATTEMPT_NOT_FOUND, 'Register attempt is missing')
  const creditAssetId = await commitPool(deps, register, readback.pool, lookup.ledger)
  const { data, error } = await deps.supabase
    .from('rwa_issuance_attempts')
    .update({
      status: 'confirmed',
      pool_contract_id: readback.pool,
      credit_asset_id: creditAssetId,
      ledger_seq: lookup.ledger,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attempt.id)
    .select(ATTEMPT_COLUMNS)
    .single()
  if (error) throw error
  return view(data as AttemptRow, false)
}

async function ensurePoolAttempt(deps: IssuanceDeps, register: AttemptRow): Promise<AttemptRow> {
  const existing = await findAttempt(
    deps.supabase,
    register.deal_id,
    register.idempotency_key,
    RWA_ISSUANCE_PHASE.pool,
  )
  if (existing && existing.status !== 'failed') return existing
  const unsignedXdr = await buildAssembledSorobanInvoke({
    sourceAddress: register.signing_wallet,
    contractId: register.registry_contract,
    functionName: 'create_funding_pool',
    args: [bytes32(register.asset_id)],
    network: register.network === 'mainnet' ? 'mainnet' : 'testnet',
    rpcUrl: deps.config.rpcUrl,
  })
  const { data, error } = await deps.supabase
    .from('rwa_issuance_attempts')
    .upsert(
      {
        deal_id: register.deal_id,
        idempotency_key: register.idempotency_key,
        network: register.network,
        registry_contract: register.registry_contract,
        asset_id: register.asset_id,
        deal_hash: register.deal_hash,
        snapshot_hash: register.snapshot_hash,
        document_root: register.document_root,
        phase: RWA_ISSUANCE_PHASE.pool,
        status: 'prepared',
        unsigned_xdr: unsignedXdr,
        signing_wallet: register.signing_wallet,
        payload: register.payload,
      },
      { onConflict: 'deal_id,idempotency_key,phase' },
    )
    .select(ATTEMPT_COLUMNS)
    .single()
  if (error) throw error
  return data as AttemptRow
}

export async function reconcileOutstandingIssuance(deps: IssuanceDeps): Promise<number> {
  const { data, error } = await deps.supabase
    .from('rwa_issuance_attempts')
    .select('id')
    .in('status', ['submitted', 'unknown'])
    .limit(25)
  if (error) throw error
  let reconciled = 0
  for (const row of data ?? []) {
    await reconcileIssuance(deps, String((row as { id: string }).id))
    reconciled += 1
  }
  return reconciled
}

export function issuanceDeps(supabase: SupabaseClient, actorId: string): IssuanceDeps {
  return { supabase, config: getRwaConfig(), actorId }
}
