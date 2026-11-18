import { isLikelyStellarAccountId, isLikelyStellarContractId } from '@/lib/defindex/stellar-address'
import { PLATFORM_FEE_PERCENT, TW_PROTOCOL_FEE_PERCENT } from '@/lib/deals/fees'

/**
 * Position-level repayment servicing for RWA credit assets.
 *
 * This module consumes an already-frozen position/entitlement ledger and binds
 * every Trustless Work multi-release milestone to an asset, a position, a
 * tranche and the wallet captured when the position was funded. It never
 * derives ownership, never calls the network and never substitutes a platform
 * wallet for an investor receiver.
 *
 * Amounts are exact integer atomic units (the token's smallest unit). The
 * `amount` field is only the display value Trustless Work expects; all
 * reconciliation compares atomic strings.
 */

export const RWA_PAYOUT_SCHEDULE_VERSION = 1
export const RWA_PAYOUT_SCHEDULE_DOMAIN = 'mercato.rwa.repayment_payout_schedule.v1'

export type PayoutNetwork = 'testnet' | 'futurenet' | 'mainnet'

export type PayoutFeePolicy = {
  readonly version: number
  readonly platformFeeBps: number
  readonly twFeeBps: number
}

/** Matches the current Mercato 1% + Trustless Work 0.3% release deductions. */
export const DEFAULT_PAYOUT_FEE_POLICY: PayoutFeePolicy = {
  version: 1,
  platformFeeBps: Math.round(PLATFORM_FEE_PERCENT * 100),
  twFeeBps: Math.round(TW_PROTOCOL_FEE_PERCENT * 100),
}

export type AtomicInput = bigint | number | string

export type FrozenPayoutPosition = {
  /** Registry asset id (32-byte hex). */
  readonly assetId: string
  /** Stable position reference from the frozen ledger. */
  readonly positionId: string
  /** Receiver captured when the position was funded. Never rewritten from a profile. */
  readonly receiver: string
  /** Wallet recorded at funding; must equal `receiver` for an RWA position. */
  readonly fundingWallet: string
  /** Frozen net entitlement for this position, across all tranches. */
  readonly netEntitlementAtomic?: AtomicInput
  /** Frozen gross obligation for this position, across all tranches. */
  readonly grossObligationAtomic?: AtomicInput
}

export type FrozenPayoutTranche = {
  readonly assetId: string
  readonly positionId: string
  /** Zero-based tranche order within the position. */
  readonly trancheIndex: number
  readonly grossAtomic: AtomicInput
  readonly netAtomic: AtomicInput
  /** Optional assertion; never a redirect. Must equal the frozen receiver. */
  readonly receiver?: string
  readonly description?: string
}

export type BuildPositionPayoutScheduleInput = {
  readonly assetId: string
  readonly assetDecimals: number
  readonly feePolicy: PayoutFeePolicy
  readonly positions: readonly FrozenPayoutPosition[]
  readonly tranches: readonly FrozenPayoutTranche[]
  readonly totalGrossAtomic: AtomicInput
  readonly totalNetAtomic: AtomicInput
  /**
   * Kept only to reject legacy single-investor overrides explicitly. RWA
   * positions must use an authorized wallet-change process instead.
   */
  readonly receiverOverride?: string
}

export type PositionPayoutMilestone = {
  readonly assetId: string
  readonly positionId: string
  readonly trancheIndex: number
  readonly milestoneIndex: number
  readonly receiver: string
  readonly description: string
  /** Trustless Work display amount (whole token units). */
  readonly amount: number
  readonly grossAtomic: string
  readonly netAtomic: string
  readonly feeAtomic: string
}

export type PositionPayoutSummary = {
  readonly positionId: string
  readonly receiver: string
  readonly trancheIndexes: readonly number[]
  readonly grossAtomic: string
  readonly netAtomic: string
  readonly feeAtomic: string
  readonly expectedNetAtomic: string | null
  /** Null when the ledger did not freeze an expected net for the position. */
  readonly matchesFrozenNet: boolean | null
}

export type PositionPayoutSchedule = {
  readonly assetId: string
  readonly assetDecimals: number
  readonly feePolicy: PayoutFeePolicy
  readonly milestones: readonly PositionPayoutMilestone[]
  readonly positions: readonly PositionPayoutSummary[]
  readonly totalGrossAtomic: string
  readonly totalNetAtomic: string
  readonly totalFeeAtomic: string
  /**
   * Canonical reviewed payload. Persisting its SHA-256 is recommended wherever
   * a fixed-width commitment is required; equality still binds every field.
   */
  readonly commitment: string
}

const HEX32 = /^[0-9a-fA-F]{64}$/
const TX_HASH = /^[0-9a-fA-F]{64}$/
const ATOMIC_PATTERN = /^(0|[1-9][0-9]*)$/

function fail(message: string): never {
  throw new Error(`rwa_payout_invalid: ${message}`)
}

function toAtomic(value: AtomicInput, field: string): bigint {
  if (typeof value === 'bigint') {
    if (value < BigInt(0)) fail(`${field} must be non-negative`)
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      fail(`${field} must be a non-negative safe integer`)
    }
    return BigInt(value)
  }
  const trimmed = value.trim()
  if (!ATOMIC_PATTERN.test(trimmed)) fail(`${field} must be a decimal integer string`)
  return BigInt(trimmed)
}

function toPositiveAtomic(value: AtomicInput, field: string): bigint {
  const amount = toAtomic(value, field)
  if (amount <= BigInt(0)) fail(`${field} must be positive`)
  return amount
}

function atomicToAmount(value: bigint, decimals: number): number {
  const asNumber = Number(value)
  if (!Number.isSafeInteger(asNumber)) fail('amount exceeds the safe integer range')
  const amount = asNumber / Math.pow(10, decimals)
  if (!Number.isFinite(amount) || amount <= 0) fail('amount is not a positive finite value')
  return amount
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('canonical JSON only accepts safe integers')
    return String(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareText)
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(',')}}`
  }
  fail(`unsupported canonical value: ${typeof value}`)
}

function validateFeePolicy(policy: PayoutFeePolicy): PayoutFeePolicy {
  if (!policy || typeof policy !== 'object') fail('fee policy is required')
  if (!Number.isInteger(policy.version) || policy.version < 1) {
    fail('fee policy version must be a positive integer')
  }
  for (const [field, value] of [
    ['platformFeeBps', policy.platformFeeBps],
    ['twFeeBps', policy.twFeeBps],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 10_000) {
      fail(`feePolicy.${field} must be an integer between 0 and 10000`)
    }
  }
  if (policy.platformFeeBps + policy.twFeeBps >= 10_000) {
    fail('combined release fee must be less than 10000 bps')
  }
  return {
    version: policy.version,
    platformFeeBps: policy.platformFeeBps,
    twFeeBps: policy.twFeeBps,
  }
}

function normalizedAssetId(value: string): string {
  const trimmed = value.trim()
  if (!HEX32.test(trimmed)) fail('assetId must be a 32-byte hex value')
  return trimmed.toLowerCase()
}

function normalizedAccount(value: string, field: string): string {
  const trimmed = value.trim()
  if (!isLikelyStellarAccountId(trimmed)) fail(`${field} must be a Stellar account address`)
  return trimmed
}

function normalizedContract(value: string, field: string): string {
  const trimmed = value.trim()
  if (!isLikelyStellarContractId(trimmed)) fail(`${field} must be a Stellar contract address`)
  return trimmed
}

/**
 * Exact pro-rata allocation of a frozen total across position weights.
 * Remainder atomic units are assigned to the last position in input order (the
 * "final investor" convention documented in doc/architecture.md §5.5).
 */
export function allocateProRataAtomic(
  totalAtomic: AtomicInput,
  weights: readonly { readonly positionId: string; readonly unitsAtomic: AtomicInput }[],
): readonly { readonly positionId: string; readonly amountAtomic: string }[] {
  const total = toAtomic(totalAtomic, 'totalAtomic')
  if (total <= BigInt(0)) fail('totalAtomic must be positive')
  if (!Array.isArray(weights) || weights.length === 0) fail('at least one position weight is required')

  const seen = new Set<string>()
  let weightTotal = BigInt(0)
  const normalized = weights.map((weight) => {
    const positionId = weight.positionId.trim()
    if (!positionId) fail('positionId is required for every weight')
    if (seen.has(positionId)) fail(`duplicate position weight: ${positionId}`)
    seen.add(positionId)
    const units = toPositiveAtomic(weight.unitsAtomic, `unitsAtomic for ${positionId}`)
    weightTotal += units
    return { positionId, units }
  })
  if (weightTotal <= BigInt(0)) fail('position weights must sum to a positive value')

  const allocated = normalized.map((weight) => ({
    positionId: weight.positionId,
    amount: (total * weight.units) / weightTotal,
  }))
  const distributed = allocated.reduce((sum, item) => sum + item.amount, BigInt(0))
  const remainder = total - distributed
  allocated[allocated.length - 1].amount += remainder

  return allocated.map((item) => ({
    positionId: item.positionId,
    amountAtomic: item.amount.toString(10),
  }))
}

/**
 * Smallest gross atomic amount whose net equals `netAtomic` after the combined
 * release fee. This is an accounting helper for frozen fixtures; it does not
 * claim the deployed contract's rounding behaviour.
 */
export function grossAtomicForNet(netAtomic: AtomicInput, combinedFeeBps: number): bigint {
  const net = toPositiveAtomic(netAtomic, 'netAtomic')
  if (!Number.isInteger(combinedFeeBps) || combinedFeeBps < 0 || combinedFeeBps >= 10_000) {
    fail('combinedFeeBps must be an integer between 0 and 9999')
  }
  if (combinedFeeBps === 0) return net
  const denominator = BigInt(10_000 - combinedFeeBps)
  return (net * BigInt(10_000) + denominator - BigInt(1)) / denominator
}

/**
 * Validates a frozen position/entitlement ledger and maps it to a deterministic
 * Trustless Work multi-release milestone schedule.
 */
export function buildPositionPayoutSchedule(
  input: BuildPositionPayoutScheduleInput,
): PositionPayoutSchedule {
  if (input.receiverOverride !== undefined) {
    fail('RWA payout schedules do not support receiver overrides; use an authorized wallet-change process')
  }
  const feePolicy = validateFeePolicy(input.feePolicy)
  const combinedFeeBps = feePolicy.platformFeeBps + feePolicy.twFeeBps
  const assetId = normalizedAssetId(input.assetId)
  if (!Number.isInteger(input.assetDecimals) || input.assetDecimals < 0 || input.assetDecimals > 18) {
    fail('assetDecimals must be an integer between 0 and 18')
  }
  if (!Array.isArray(input.positions) || input.positions.length === 0) {
    fail('at least one frozen position is required')
  }
  if (!Array.isArray(input.tranches) || input.tranches.length === 0) {
    fail('at least one payout tranche is required')
  }

  const positions = new Map<
    string,
    {
      positionId: string
      receiver: string
      fundingWallet: string
      expectedNet: bigint | null
      expectedGross: bigint | null
    }
  >()

  for (const position of input.positions) {
    const positionId = position.positionId.trim()
    if (!positionId) fail('positionId is required')
    if (positions.has(positionId)) fail(`duplicate position reference: ${positionId}`)
    if (normalizedAssetId(position.assetId) !== assetId) {
      fail(`position ${positionId} belongs to a different asset`)
    }
    const receiver = normalizedAccount(position.receiver, `receiver for ${positionId}`)
    const fundingWallet = normalizedAccount(position.fundingWallet, `fundingWallet for ${positionId}`)
    if (receiver !== fundingWallet) {
      fail(`position ${positionId} receiver does not match its immutable funding wallet`)
    }
    const expectedNet =
      position.netEntitlementAtomic === undefined
        ? null
        : toAtomic(position.netEntitlementAtomic, `netEntitlementAtomic for ${positionId}`)
    const expectedGross =
      position.grossObligationAtomic === undefined
        ? null
        : toAtomic(position.grossObligationAtomic, `grossObligationAtomic for ${positionId}`)
    if (expectedNet !== null && expectedGross !== null && expectedNet > expectedGross) {
      fail(`position ${positionId} net entitlement cannot exceed its gross obligation`)
    }
    positions.set(positionId, {
      positionId,
      receiver,
      fundingWallet,
      expectedNet,
      expectedGross,
    })
  }

  const seenTranches = new Set<string>()
  const normalizedTranches = input.tranches.map((tranche) => {
    const positionId = tranche.positionId.trim()
    const position = positions.get(positionId)
    if (!position) fail(`tranche references an unknown position: ${positionId}`)
    if (normalizedAssetId(tranche.assetId) !== assetId) {
      fail(`tranche for ${positionId} belongs to a different asset`)
    }
    if (!Number.isInteger(tranche.trancheIndex) || tranche.trancheIndex < 0) {
      fail(`trancheIndex for ${positionId} must be a non-negative integer`)
    }
    const key = `${positionId}:${tranche.trancheIndex}`
    if (seenTranches.has(key)) fail(`duplicate tranche ${key}`)
    seenTranches.add(key)

    const gross = toPositiveAtomic(tranche.grossAtomic, `grossAtomic for ${key}`)
    const net = toPositiveAtomic(tranche.netAtomic, `netAtomic for ${key}`)
    if (net > gross) fail(`tranche ${key} net amount cannot exceed its gross amount`)
    if (combinedFeeBps > 0 && gross === net) {
      fail(`tranche ${key} has no release fee under the frozen fee policy`)
    }
    if (tranche.receiver !== undefined) {
      const receiver = normalizedAccount(tranche.receiver, `receiver for tranche ${key}`)
      if (receiver !== position.receiver) {
        fail(`tranche ${key} attempts to redirect the frozen receiver`)
      }
    }

    return {
      positionId,
      trancheIndex: tranche.trancheIndex,
      gross,
      net,
      fee: gross - net,
      receiver: position.receiver,
      description: tranche.description?.trim() || `Position ${positionId} tranche ${tranche.trancheIndex + 1}`,
    }
  })

  const grouped = new Map<
    string,
    { gross: bigint; net: bigint; fee: bigint; trancheIndexes: number[] }
  >()
  for (const position of positions.values()) {
    grouped.set(position.positionId, {
      gross: BigInt(0),
      net: BigInt(0),
      fee: BigInt(0),
      trancheIndexes: [],
    })
  }
  for (const tranche of normalizedTranches) {
    const group = grouped.get(tranche.positionId)
    if (!group) continue
    group.gross += tranche.gross
    group.net += tranche.net
    group.fee += tranche.fee
    group.trancheIndexes.push(tranche.trancheIndex)
  }
  for (const position of positions.values()) {
    const group = grouped.get(position.positionId)
    if (!group || group.trancheIndexes.length === 0) {
      fail(`position ${position.positionId} has no scheduled payout tranche`)
    }
    if (position.expectedNet !== null && group.net !== position.expectedNet) {
      fail(
        `position ${position.positionId} scheduled net (${group.net.toString(10)}) does not match its frozen entitlement (${position.expectedNet.toString(10)})`,
      )
    }
    if (position.expectedGross !== null && group.gross !== position.expectedGross) {
      fail(
        `position ${position.positionId} scheduled gross (${group.gross.toString(10)}) does not match its frozen obligation (${position.expectedGross.toString(10)})`,
      )
    }
  }

  normalizedTranches.sort(
    (a, b) => compareText(a.positionId, b.positionId) || a.trancheIndex - b.trancheIndex,
  )

  const milestones: PositionPayoutMilestone[] = normalizedTranches.map((tranche, index) => ({
    assetId,
    positionId: tranche.positionId,
    trancheIndex: tranche.trancheIndex,
    milestoneIndex: index,
    receiver: tranche.receiver,
    description: tranche.description,
    amount: atomicToAmount(tranche.gross, input.assetDecimals),
    grossAtomic: tranche.gross.toString(10),
    netAtomic: tranche.net.toString(10),
    feeAtomic: tranche.fee.toString(10),
  }))

  const totalGross = milestones.reduce((sum, milestone) => sum + BigInt(milestone.grossAtomic), BigInt(0))
  const totalNet = milestones.reduce((sum, milestone) => sum + BigInt(milestone.netAtomic), BigInt(0))
  const totalFee = totalGross - totalNet
  if (totalGross !== toAtomic(input.totalGrossAtomic, 'totalGrossAtomic')) {
    fail(
      `scheduled gross (${totalGross.toString(10)}) does not match the frozen gross total (${toAtomic(input.totalGrossAtomic, 'totalGrossAtomic').toString(10)})`,
    )
  }
  if (totalNet !== toAtomic(input.totalNetAtomic, 'totalNetAtomic')) {
    fail(
      `scheduled net (${totalNet.toString(10)}) does not match the frozen net total (${toAtomic(input.totalNetAtomic, 'totalNetAtomic').toString(10)})`,
    )
  }

  const positionSummaries: PositionPayoutSummary[] = [...positions.values()]
    .sort((a, b) => compareText(a.positionId, b.positionId))
    .map((position) => {
      const group = grouped.get(position.positionId)!
      return {
        positionId: position.positionId,
        receiver: position.receiver,
        trancheIndexes: [...group.trancheIndexes].sort((a, b) => a - b),
        grossAtomic: group.gross.toString(10),
        netAtomic: group.net.toString(10),
        feeAtomic: group.fee.toString(10),
        expectedNetAtomic: position.expectedNet === null ? null : position.expectedNet.toString(10),
        matchesFrozenNet: position.expectedNet === null ? null : group.net === position.expectedNet,
      }
    })

  const commitmentPayload = {
    version: RWA_PAYOUT_SCHEDULE_VERSION,
    domain: RWA_PAYOUT_SCHEDULE_DOMAIN,
    asset_id: assetId,
    asset_decimals: input.assetDecimals,
    fee_policy: {
      version: feePolicy.version,
      platform_fee_bps: feePolicy.platformFeeBps,
      tw_fee_bps: feePolicy.twFeeBps,
    },
    positions: positionSummaries.map((position) => ({
      position_id: position.positionId,
      receiver: position.receiver,
      gross_atomic: position.grossAtomic,
      net_atomic: position.netAtomic,
      expected_net_atomic: position.expectedNetAtomic,
    })),
    milestones: milestones.map((milestone) => ({
      position_id: milestone.positionId,
      tranche_index: milestone.trancheIndex,
      milestone_index: milestone.milestoneIndex,
      receiver: milestone.receiver,
      gross_atomic: milestone.grossAtomic,
      net_atomic: milestone.netAtomic,
      fee_atomic: milestone.feeAtomic,
      description: milestone.description,
    })),
    total_gross_atomic: totalGross.toString(10),
    total_net_atomic: totalNet.toString(10),
    total_fee_atomic: totalFee.toString(10),
  }

  return {
    assetId,
    assetDecimals: input.assetDecimals,
    feePolicy,
    milestones,
    positions: positionSummaries,
    totalGrossAtomic: totalGross.toString(10),
    totalNetAtomic: totalNet.toString(10),
    totalFeeAtomic: totalFee.toString(10),
    commitment: canonicalize(commitmentPayload),
  }
}

export type PayoutAuditContext = {
  readonly assetId: string
  readonly positionId: string
  readonly trancheIndex: number
  readonly milestoneIndex: number
  readonly receiver: string
  readonly grossAtomic: string
  readonly netAtomic: string
  readonly feeAtomic: string
  readonly scheduleCommitment: string
  readonly settledNetAtomic?: string
  readonly outstandingNetAtomic?: string
}

/** Structured position/tranche context for the append-only escrow audit payload. */
export function buildPayoutAuditContext(
  schedule: PositionPayoutSchedule,
  milestone: PositionPayoutMilestone,
  settlement?: { readonly settledNetAtomic: string; readonly outstandingNetAtomic: string },
): PayoutAuditContext {
  return {
    assetId: schedule.assetId,
    positionId: milestone.positionId,
    trancheIndex: milestone.trancheIndex,
    milestoneIndex: milestone.milestoneIndex,
    receiver: milestone.receiver,
    grossAtomic: milestone.grossAtomic,
    netAtomic: milestone.netAtomic,
    feeAtomic: milestone.feeAtomic,
    scheduleCommitment: schedule.commitment,
    settledNetAtomic: settlement?.settledNetAtomic,
    outstandingNetAtomic: settlement?.outstandingNetAtomic,
  }
}

export type RepaymentPayoutState = 'prepared' | 'submitted' | 'unknown' | 'failed' | 'confirmed'

export type RepaymentPayoutConfirmation = {
  readonly txHash: string
  readonly operationOrEventId: string
  readonly ledgerSeq: number
  readonly confirmedAt: string
}

export type RepaymentPayoutIntent = {
  readonly idempotencyKey: string
  readonly assetId: string
  readonly positionId: string
  readonly trancheIndex: number
  readonly milestoneIndex: number
  readonly network: PayoutNetwork
  readonly escrowContract: string
  readonly sacContract: string
  readonly releaseSigner: string
  readonly receiver: string
  readonly grossAtomic: string
  readonly netAtomic: string
  readonly feeAtomic: string
  readonly scheduleCommitment: string
  readonly state: RepaymentPayoutState
  readonly submissionHash: string | null
  readonly confirmation: RepaymentPayoutConfirmation | null
  readonly lastError: string | null
  readonly updatedAt: string
}

export type RepaymentPayoutEvidence = {
  readonly successful: boolean
  readonly network: PayoutNetwork
  readonly escrowContract: string
  readonly sacContract: string
  readonly receiver: string
  readonly netAtomic: AtomicInput
  readonly txHash: string
  readonly operationOrEventId: string
  readonly ledgerSeq: number
}

export type PayoutIntentContext = {
  readonly network: PayoutNetwork
  readonly escrowContract: string
  readonly sacContract: string
  readonly releaseSigner: string
  readonly authorizedReleaseSigner: string
}

export interface RepaymentPayoutRepository {
  get(idempotencyKey: string): Promise<RepaymentPayoutIntent | null>
  save(intent: RepaymentPayoutIntent): Promise<void>
  listByPosition(assetId: string, positionId: string): Promise<readonly RepaymentPayoutIntent[]>
  listAll(): Promise<readonly RepaymentPayoutIntent[]>
}

/** Deterministic key shared by prepare, submit and confirm operations. */
export function payoutIdempotencyKey(
  assetId: string,
  positionId: string,
  trancheIndex: number,
): string {
  return `${assetId.trim().toLowerCase()}:${encodeURIComponent(positionId.trim())}:${trancheIndex}`
}

export class InMemoryRepaymentPayoutRepository implements RepaymentPayoutRepository {
  private readonly records = new Map<string, RepaymentPayoutIntent>()

  async get(idempotencyKey: string): Promise<RepaymentPayoutIntent | null> {
    return this.records.get(idempotencyKey) ?? null
  }

  async save(intent: RepaymentPayoutIntent): Promise<void> {
    this.records.set(intent.idempotencyKey, intent)
  }

  async listByPosition(
    assetId: string,
    positionId: string,
  ): Promise<readonly RepaymentPayoutIntent[]> {
    return [...this.records.values()].filter(
      (intent) =>
        intent.assetId === assetId.trim().toLowerCase() && intent.positionId === positionId.trim(),
    )
  }

  async listAll(): Promise<readonly RepaymentPayoutIntent[]> {
    return [...this.records.values()]
  }
}

function validateContext(context: PayoutIntentContext): PayoutIntentContext {
  if (!['testnet', 'futurenet', 'mainnet'].includes(context.network)) {
    fail('network must be testnet, futurenet or mainnet')
  }
  const escrowContract = normalizedContract(context.escrowContract, 'escrowContract')
  const sacContract = normalizedContract(context.sacContract, 'sacContract')
  const releaseSigner = normalizedAccount(context.releaseSigner, 'releaseSigner')
  const authorizedReleaseSigner = normalizedAccount(
    context.authorizedReleaseSigner,
    'authorizedReleaseSigner',
  )
  if (releaseSigner !== authorizedReleaseSigner) {
    fail('release signer is not authorized for this escrow')
  }
  return {
    network: context.network,
    escrowContract,
    sacContract,
    releaseSigner,
    authorizedReleaseSigner,
  }
}

function sameIntentBinding(
  intent: RepaymentPayoutIntent,
  schedule: PositionPayoutSchedule,
  milestone: PositionPayoutMilestone,
  context: PayoutIntentContext,
): boolean {
  return (
    intent.assetId === schedule.assetId &&
    intent.positionId === milestone.positionId &&
    intent.trancheIndex === milestone.trancheIndex &&
    intent.milestoneIndex === milestone.milestoneIndex &&
    intent.network === context.network &&
    intent.escrowContract === context.escrowContract &&
    intent.sacContract === context.sacContract &&
    intent.releaseSigner === context.releaseSigner &&
    intent.receiver === milestone.receiver &&
    intent.grossAtomic === milestone.grossAtomic &&
    intent.netAtomic === milestone.netAtomic &&
    intent.feeAtomic === milestone.feeAtomic &&
    intent.scheduleCommitment === schedule.commitment
  )
}

/**
 * Creates one recoverable intent per milestone. Re-running with the same frozen
 * schedule and context is idempotent; changing any bound field is rejected.
 */
export async function preparePositionPayoutIntents(
  repository: RepaymentPayoutRepository,
  schedule: PositionPayoutSchedule,
  contextInput: PayoutIntentContext,
  now: string = new Date().toISOString(),
): Promise<readonly RepaymentPayoutIntent[]> {
  const context = validateContext(contextInput)
  const prepared: RepaymentPayoutIntent[] = []

  for (const milestone of schedule.milestones) {
    const key = payoutIdempotencyKey(schedule.assetId, milestone.positionId, milestone.trancheIndex)
    const existing = await repository.get(key)
    if (existing) {
      if (!sameIntentBinding(existing, schedule, milestone, context)) {
        fail(`payout intent ${key} is already bound to a different schedule or escrow context`)
      }
      prepared.push(existing)
      continue
    }
    const intent: RepaymentPayoutIntent = {
      idempotencyKey: key,
      assetId: schedule.assetId,
      positionId: milestone.positionId,
      trancheIndex: milestone.trancheIndex,
      milestoneIndex: milestone.milestoneIndex,
      network: context.network,
      escrowContract: context.escrowContract,
      sacContract: context.sacContract,
      releaseSigner: context.releaseSigner,
      receiver: milestone.receiver,
      grossAtomic: milestone.grossAtomic,
      netAtomic: milestone.netAtomic,
      feeAtomic: milestone.feeAtomic,
      scheduleCommitment: schedule.commitment,
      state: 'prepared',
      submissionHash: null,
      confirmation: null,
      lastError: null,
      updatedAt: now,
    }
    await repository.save(intent)
    prepared.push(intent)
  }

  return prepared
}

async function loadIntent(
  repository: RepaymentPayoutRepository,
  idempotencyKey: string,
): Promise<RepaymentPayoutIntent> {
  const intent = await repository.get(idempotencyKey)
  if (!intent) fail(`unknown payout intent: ${idempotencyKey}`)
  return intent
}

export async function markPayoutSubmitted(
  repository: RepaymentPayoutRepository,
  idempotencyKey: string,
  submissionHash: string,
  now: string = new Date().toISOString(),
): Promise<RepaymentPayoutIntent> {
  const hash = submissionHash.trim().toLowerCase()
  if (!TX_HASH.test(hash)) fail('submissionHash must be a 32-byte hex transaction hash')
  const intent = await loadIntent(repository, idempotencyKey)
  if (intent.state === 'confirmed') return intent
  if (intent.state === 'failed') fail('a definitively failed payout cannot be resubmitted')
  if (intent.submissionHash !== null && intent.submissionHash !== hash) {
    fail('payout was already submitted with a different transaction hash')
  }
  if (intent.state === 'submitted' && intent.submissionHash === hash) return intent

  const next: RepaymentPayoutIntent = {
    ...intent,
    state: 'submitted',
    submissionHash: hash,
    lastError: null,
    updatedAt: now,
  }
  await repository.save(next)
  return next
}

export async function markPayoutUnknown(
  repository: RepaymentPayoutRepository,
  idempotencyKey: string,
  reason: string,
  now: string = new Date().toISOString(),
): Promise<RepaymentPayoutIntent> {
  const message = reason.trim()
  if (!message) fail('an unknown payout requires a reason')
  const intent = await loadIntent(repository, idempotencyKey)
  if (intent.state === 'confirmed') return intent
  if (intent.state === 'failed') fail('a definitively failed payout cannot become unknown')
  const next: RepaymentPayoutIntent = {
    ...intent,
    state: 'unknown',
    lastError: message,
    updatedAt: now,
  }
  await repository.save(next)
  return next
}

export async function markPayoutFailed(
  repository: RepaymentPayoutRepository,
  idempotencyKey: string,
  reason: string,
  now: string = new Date().toISOString(),
): Promise<RepaymentPayoutIntent> {
  const message = reason.trim()
  if (!message) fail('a failed payout requires a reason')
  const intent = await loadIntent(repository, idempotencyKey)
  if (intent.state === 'confirmed') fail('a confirmed payout cannot be marked failed')
  if (intent.state === 'failed' && intent.lastError === message) return intent
  const next: RepaymentPayoutIntent = {
    ...intent,
    state: 'failed',
    lastError: message,
    updatedAt: now,
  }
  await repository.save(next)
  return next
}

function validateEvidence(intent: RepaymentPayoutIntent, evidence: RepaymentPayoutEvidence): void {
  if (!evidence.successful) fail('payout evidence must come from a successful transaction')
  if (evidence.network !== intent.network) fail('payout evidence network does not match the escrow')
  if (evidence.escrowContract.trim() !== intent.escrowContract) {
    fail('payout evidence escrow contract does not match')
  }
  if (evidence.sacContract.trim() !== intent.sacContract) {
    fail('payout evidence SAC contract does not match')
  }
  if (evidence.receiver.trim() !== intent.receiver) {
    fail('payout evidence receiver does not match the frozen position receiver')
  }
  if (toAtomic(evidence.netAtomic, 'evidence.netAtomic') !== BigInt(intent.netAtomic)) {
    fail('payout evidence net amount does not match the frozen entitlement exactly')
  }
  if (!TX_HASH.test(evidence.txHash.trim())) {
    fail('payout evidence txHash must be a 32-byte hex transaction hash')
  }
  const eventId = evidence.operationOrEventId.trim()
  if (!eventId || eventId.length > 128) {
    fail('payout evidence operationOrEventId is required')
  }
  if (!Number.isInteger(evidence.ledgerSeq) || evidence.ledgerSeq <= 0) {
    fail('payout evidence ledgerSeq must be a positive integer')
  }
}

function confirmationMatches(
  confirmation: RepaymentPayoutConfirmation,
  evidence: RepaymentPayoutEvidence,
): boolean {
  return (
    confirmation.txHash === evidence.txHash.trim().toLowerCase() &&
    confirmation.operationOrEventId === evidence.operationOrEventId.trim() &&
    confirmation.ledgerSeq === evidence.ledgerSeq
  )
}

/**
 * Confirms a payout from verified on-chain evidence. Confirmation is
 * idempotent for the same evidence, refuses a definitive failure, and refuses a
 * second intent claiming the same on-chain transfer.
 */
export async function confirmPayout(
  repository: RepaymentPayoutRepository,
  idempotencyKey: string,
  evidence: RepaymentPayoutEvidence,
  now: string = new Date().toISOString(),
): Promise<RepaymentPayoutIntent> {
  const intent = await loadIntent(repository, idempotencyKey)
  validateEvidence(intent, evidence)

  if (intent.state === 'confirmed' && intent.confirmation) {
    if (confirmationMatches(intent.confirmation, evidence)) return intent
    fail('payout is already confirmed with different evidence')
  }
  if (intent.state === 'failed') fail('a definitively failed payout cannot be confirmed')

  const txHash = evidence.txHash.trim().toLowerCase()
  const eventId = evidence.operationOrEventId.trim()
  const all = await repository.listAll()
  const duplicate = all.find(
    (other) =>
      other.idempotencyKey !== idempotencyKey &&
      other.state === 'confirmed' &&
      other.network === intent.network &&
      other.confirmation?.txHash === txHash &&
      other.confirmation?.operationOrEventId === eventId,
  )
  if (duplicate) fail('on-chain evidence is already attributed to another payout')

  const next: RepaymentPayoutIntent = {
    ...intent,
    state: 'confirmed',
    submissionHash: intent.submissionHash ?? txHash,
    confirmation: {
      txHash,
      operationOrEventId: eventId,
      ledgerSeq: evidence.ledgerSeq,
      confirmedAt: now,
    },
    lastError: null,
    updatedAt: now,
  }
  await repository.save(next)
  return next
}

export type PositionSettlementStatus = 'unpaid' | 'partial' | 'settled' | 'overpaid'

export type PositionSettlementSummary = {
  readonly positionId: string
  readonly requiredNetAtomic: string
  readonly settledNetAtomic: string
  readonly outstandingNetAtomic: string
  readonly status: PositionSettlementStatus
  readonly pendingTranches: number
  readonly failedTranches: number
  readonly confirmedTranches: number
}

/**
 * Computes one position's settlement from confirmed intents only. A payment to
 * another position is never included, and a position is never closed short of
 * its exact frozen entitlement.
 */
export function summarizePositionSettlement(
  intents: readonly RepaymentPayoutIntent[],
  args: { readonly positionId: string; readonly requiredNetAtomic: AtomicInput },
): PositionSettlementSummary {
  const positionId = args.positionId.trim()
  if (!positionId) fail('positionId is required')
  const required = toAtomic(args.requiredNetAtomic, 'requiredNetAtomic')
  const own = intents.filter((intent) => intent.positionId === positionId)

  let settled = BigInt(0)
  let pending = 0
  let failed = 0
  let confirmed = 0
  for (const intent of own) {
    if (intent.state === 'confirmed') {
      settled += BigInt(intent.netAtomic)
      confirmed += 1
    } else if (intent.state === 'failed') {
      failed += 1
    } else {
      pending += 1
    }
  }

  let status: PositionSettlementStatus
  if (settled === required) status = 'settled'
  else if (settled > required) status = 'overpaid'
  else if (settled === BigInt(0)) status = 'unpaid'
  else status = 'partial'

  return {
    positionId,
    requiredNetAtomic: required.toString(10),
    settledNetAtomic: settled.toString(10),
    outstandingNetAtomic: (required - settled).toString(10),
    status,
    pendingTranches: pending,
    failedTranches: failed,
    confirmedTranches: confirmed,
  }
}
