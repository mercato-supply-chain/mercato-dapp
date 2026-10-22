import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  RepaymentPayoutIntent,
  RepaymentPayoutRepository,
  RepaymentPayoutState,
} from '@/lib/trustless/repayment-position-payout'

const TABLE = 'rwa_repayment_payout_intents'

const COLUMNS = [
  'idempotency_key',
  'deal_id',
  'asset_id',
  'position_id',
  'tranche_index',
  'milestone_index',
  'network',
  'escrow_contract',
  'sac_contract',
  'release_signer',
  'receiver',
  'gross_atomic',
  'net_atomic',
  'fee_atomic',
  'schedule_commitment',
  'state',
  'submission_hash',
  'confirmation_tx_hash',
  'confirmation_operation_or_event_id',
  'confirmation_ledger_seq',
  'confirmed_at',
  'last_error',
  'created_at',
  'updated_at',
].join(', ')

export type RepaymentPayoutIntentRow = {
  idempotency_key: string
  deal_id?: string | null
  asset_id: string
  position_id: string
  tranche_index: number
  milestone_index: number
  network: RepaymentPayoutIntent['network']
  escrow_contract: string
  sac_contract: string
  release_signer: string
  receiver: string
  gross_atomic: string | number
  net_atomic: string | number
  fee_atomic: string | number
  schedule_commitment: string
  state: RepaymentPayoutState
  submission_hash: string | null
  confirmation_tx_hash: string | null
  confirmation_operation_or_event_id: string | null
  confirmation_ledger_seq: string | number | null
  confirmed_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type RepaymentPayoutIntentWriteRow = Omit<RepaymentPayoutIntentRow, 'created_at'> & {
  created_at?: string
}

/** Exact row shape written by the intent service. */
export function toRepaymentPayoutIntentRow(
  intent: RepaymentPayoutIntent,
  dealId: string | null = null,
): RepaymentPayoutIntentWriteRow {
  return {
    idempotency_key: intent.idempotencyKey,
    ...(dealId ? { deal_id: dealId } : {}),
    asset_id: intent.assetId,
    position_id: intent.positionId,
    tranche_index: intent.trancheIndex,
    milestone_index: intent.milestoneIndex,
    network: intent.network,
    escrow_contract: intent.escrowContract,
    sac_contract: intent.sacContract,
    release_signer: intent.releaseSigner,
    receiver: intent.receiver,
    gross_atomic: intent.grossAtomic,
    net_atomic: intent.netAtomic,
    fee_atomic: intent.feeAtomic,
    schedule_commitment: intent.scheduleCommitment,
    state: intent.state,
    submission_hash: intent.submissionHash,
    confirmation_tx_hash: intent.confirmation?.txHash ?? null,
    confirmation_operation_or_event_id: intent.confirmation?.operationOrEventId ?? null,
    confirmation_ledger_seq: intent.confirmation?.ledgerSeq ?? null,
    confirmed_at: intent.confirmation?.confirmedAt ?? null,
    last_error: intent.lastError,
    updated_at: intent.updatedAt,
  }
}

export function fromRepaymentPayoutIntentRow(row: RepaymentPayoutIntentRow): RepaymentPayoutIntent {
  const txHash = row.confirmation_tx_hash
  const eventId = row.confirmation_operation_or_event_id
  const ledgerSeq = row.confirmation_ledger_seq
  const confirmedAt = row.confirmed_at
  const confirmation =
    txHash !== null && eventId !== null && ledgerSeq !== null && confirmedAt !== null
      ? {
          txHash,
          operationOrEventId: eventId,
          ledgerSeq: Number(ledgerSeq),
          confirmedAt,
        }
      : null

  return {
    idempotencyKey: row.idempotency_key,
    assetId: row.asset_id,
    positionId: row.position_id,
    trancheIndex: row.tranche_index,
    milestoneIndex: row.milestone_index,
    network: row.network,
    escrowContract: row.escrow_contract,
    sacContract: row.sac_contract,
    releaseSigner: row.release_signer,
    receiver: row.receiver,
    grossAtomic: String(row.gross_atomic),
    netAtomic: String(row.net_atomic),
    feeAtomic: String(row.fee_atomic),
    scheduleCommitment: row.schedule_commitment,
    state: row.state,
    submissionHash: row.submission_hash,
    confirmation,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_TRANSITIONS: Record<RepaymentPayoutState, readonly RepaymentPayoutState[]> = {
  prepared: ['prepared', 'submitted', 'unknown', 'failed', 'confirmed'],
  submitted: ['submitted', 'unknown', 'failed', 'confirmed'],
  unknown: ['unknown', 'failed', 'confirmed'],
  failed: ['failed'],
  confirmed: ['confirmed'],
}

function assertTransition(existing: RepaymentPayoutIntent, next: RepaymentPayoutIntent): void {
  if (!ALLOWED_TRANSITIONS[existing.state].includes(next.state)) {
    throw new Error(`invalid payout intent transition ${existing.state} -> ${next.state}`)
  }
  if (
    existing.assetId !== next.assetId ||
    existing.positionId !== next.positionId ||
    existing.trancheIndex !== next.trancheIndex ||
    existing.milestoneIndex !== next.milestoneIndex ||
    existing.network !== next.network ||
    existing.escrowContract !== next.escrowContract ||
    existing.sacContract !== next.sacContract ||
    existing.releaseSigner !== next.releaseSigner ||
    existing.receiver !== next.receiver ||
    existing.grossAtomic !== next.grossAtomic ||
    existing.netAtomic !== next.netAtomic ||
    existing.feeAtomic !== next.feeAtomic ||
    existing.scheduleCommitment !== next.scheduleCommitment
  ) {
    throw new Error('payout intent binding fields are immutable')
  }
  if (existing.submissionHash !== null && existing.submissionHash !== next.submissionHash) {
    throw new Error('payout submission hash is immutable')
  }
  if (existing.confirmation !== null) {
    if (
      next.confirmation === null ||
      existing.confirmation.txHash !== next.confirmation.txHash ||
      existing.confirmation.operationOrEventId !== next.confirmation.operationOrEventId ||
      existing.confirmation.ledgerSeq !== next.confirmation.ledgerSeq
    ) {
      throw new Error('payout confirmation evidence is immutable')
    }
  }
}

/**
 * Service-role repository for the recoverable payout intent table.
 *
 * Never construct this from a browser session: the intent table has no client
 * write policy, and the service role is only available server-side.
 */
export class SupabaseRepaymentPayoutRepository implements RepaymentPayoutRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly dealId: string | null = null,
  ) {}

  async get(idempotencyKey: string): Promise<RepaymentPayoutIntent | null> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (error) throw error
    return data
      ? fromRepaymentPayoutIntentRow(data as unknown as RepaymentPayoutIntentRow)
      : null
  }

  async save(intent: RepaymentPayoutIntent): Promise<void> {
    const existing = await this.get(intent.idempotencyKey)
    if (!existing) {
      const { error } = await this.supabase
        .from(TABLE)
        .insert(toRepaymentPayoutIntentRow(intent, this.dealId))
      if (error) throw error
      return
    }

    assertTransition(existing, intent)
    const { error } = await this.supabase
      .from(TABLE)
      .update(toRepaymentPayoutIntentRow(intent))
      .eq('idempotency_key', intent.idempotencyKey)
    if (error) throw error
  }

  async listByPosition(
    assetId: string,
    positionId: string,
  ): Promise<readonly RepaymentPayoutIntent[]> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('asset_id', assetId.trim().toLowerCase())
      .eq('position_id', positionId.trim())
      .order('tranche_index', { ascending: true })
    if (error) throw error
    return ((data ?? []) as unknown as RepaymentPayoutIntentRow[]).map((row) =>
      fromRepaymentPayoutIntentRow(row),
    )
  }

  async listAll(): Promise<readonly RepaymentPayoutIntent[]> {
    const { data, error } = await this.supabase.from(TABLE).select(COLUMNS)
    if (error) throw error
    return ((data ?? []) as unknown as RepaymentPayoutIntentRow[]).map((row) =>
      fromRepaymentPayoutIntentRow(row),
    )
  }
}

export function createSupabaseRepaymentPayoutRepository(
  dealId: string | null = null,
): SupabaseRepaymentPayoutRepository {
  return new SupabaseRepaymentPayoutRepository(createServiceClient(), dealId)
}
