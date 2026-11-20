import { createHash } from 'node:crypto'

/**
 * Canonical RWA financial/document commitments.
 *
 * Layer 1 (this file) is the single source of truth for what a credit asset commits to:
 * byte encoding, hash algorithm, ordered fields and normalization. It deliberately does
 * not read the database, sign anything or talk to a contract — downstream contract and API
 * contributors consume these values.
 *
 * See doc/rwa-architecture.md § Commitment specification.
 */

/** Version of the financial snapshot schema. Bump only with a new fixture set. */
export const RWA_SNAPSHOT_VERSION = 1

export const RWA_SNAPSHOT_DOMAIN = 'mercato.rwa.financial_snapshot.v1'
export const RWA_DOCUMENT_DOMAIN = 'mercato.rwa.document.v1'

/**
 * Ordered field list hashed inside the snapshot. Any change to this list is a new
 * snapshot version; `__tests__/rwa/commitment.test.ts` pins the order.
 */
export const RWA_SNAPSHOT_FIELDS = [
  'snapshot_version',
  'deal_id',
  'network',
  'asset_code',
  'asset_issuer',
  'asset_decimals',
  'principal_atomic',
  'return_numerator',
  'return_denominator',
  'display_yield_bps',
  'term_days',
  'maturity_policy',
  'fees',
  'issued_at',
  'issuance_identity',
] as const

export const RWA_FEE_FIELDS = [
  'platform_fee_bps',
  'tw_fee_bps',
  'rounding_policy',
  'charged_at',
] as const

export type RwaNetwork = 'testnet' | 'futurenet' | 'mainnet'
export type RwaMaturityPolicy = 'delivery_relative'
export type RwaRoundingPolicy = 'half_up_atomic'

export interface RwaFees {
  platform_fee_bps: number
  tw_fee_bps: number
  rounding_policy: RwaRoundingPolicy
  /** When the fees are taken relative to funding. Never part of entitlement. */
  charged_at: 'funding'
}

export interface RwaFinancialSnapshot {
  snapshot_version: number
  deal_id: string
  network: RwaNetwork
  asset_code: string
  asset_issuer: string
  asset_decimals: number
  /** Atomic units as a decimal string — never a float. */
  principal_atomic: string
  return_numerator: string
  return_denominator: string
  /** Presentation only; entitlement comes from the return ratio. */
  display_yield_bps: number
  term_days: number
  maturity_policy: RwaMaturityPolicy
  fees: RwaFees
  /** RFC 3339 UTC with `Z`. */
  issued_at: string
  issuance_identity: string
}

export interface RwaDocumentCommitment {
  doc_kind: string
  content_hash: string
  byte_length: string
  canonicalization: 'JCS-RFC8785' | 'raw_bytes'
}

const UINT_PATTERN = /^(0|[1-9][0-9]*)$/
const HEX64_PATTERN = /^[0-9a-f]{64}$/
const RFC3339_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

function fail(message: string): never {
  throw new Error(`rwa_commitment_invalid: ${message}`)
}

/**
 * Coerce an integer-like value to a decimal string, rejecting floats, negatives and
 * anything that would lose precision. Numeric inputs must be safe integers.
 */
export function toAtomicString(value: bigint | number | string, field: string): string {
  if (typeof value === 'bigint') {
    if (value < BigInt(0)) fail(`${field} must be non-negative`)
    return value.toString(10)
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      fail(`${field} must be a non-negative safe integer`)
    }
    return value.toString(10)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^-\d+$/.test(trimmed)) fail(`${field} must be non-negative`)
    if (!UINT_PATTERN.test(trimmed)) fail(`${field} must be a decimal integer string`)
    return trimmed
  }

  fail(`${field} is not an integer value`)
}

/**
 * RFC 8785-style canonical JSON: lexicographic key order, no whitespace, no floats.
 * Amounts are already strings, so no number formatting rules are needed.
 */
export function canonicalizeRwaValue(value: unknown): string {
  if (value === null) return 'null'

  if (typeof value === 'string') return JSON.stringify(value)

  if (typeof value === 'boolean') return value ? 'true' : 'false'

  if (typeof value === 'number') {
    // Snapshot amounts are strings; a float here would make cross-language hashing unsafe.
    if (!Number.isFinite(value)) fail('non-finite number in canonical JSON')
    if (!Number.isSafeInteger(value)) fail('floats are not allowed in canonical JSON')
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeRwaValue(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()

    const body = keys
      .map((key) => `${JSON.stringify(key)}:${canonicalizeRwaValue(record[key])}`)
      .join(',')

    return `{${body}}`
  }

  fail(`unsupported value type: ${typeof value}`)
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** Domain-separated SHA-256 over the canonical encoding of `payload`. */
export function hashRwaCommitment(domain: string, payload: unknown): string {
  if (!domain) fail('domain is required')
  return sha256Hex(`${domain}\n${canonicalizeRwaValue(payload)}`)
}

export function hashFinancialSnapshot(snapshot: RwaFinancialSnapshot): string {
  return hashRwaCommitment(RWA_SNAPSHOT_DOMAIN, snapshot)
}

export function hashDocumentCommitment(document: RwaDocumentCommitment): string {
  return hashRwaCommitment(RWA_DOCUMENT_DOMAIN, document)
}

function validateFees(fees: RwaFees): RwaFees {
  if (!fees || typeof fees !== 'object') fail('fees are required')
  for (const field of RWA_FEE_FIELDS) {
    if (fees[field as keyof RwaFees] === undefined) fail(`fees.${field} is required`)
  }
  if (!Number.isInteger(fees.platform_fee_bps) || fees.platform_fee_bps < 0) {
    fail('fees.platform_fee_bps must be a non-negative integer')
  }
  if (!Number.isInteger(fees.tw_fee_bps) || fees.tw_fee_bps < 0) {
    fail('fees.tw_fee_bps must be a non-negative integer')
  }
  if (fees.rounding_policy !== 'half_up_atomic') {
    fail('fees.rounding_policy must be half_up_atomic')
  }
  if (fees.charged_at !== 'funding') fail('fees.charged_at must be funding')

  return {
    platform_fee_bps: fees.platform_fee_bps,
    tw_fee_bps: fees.tw_fee_bps,
    rounding_policy: fees.rounding_policy,
    charged_at: fees.charged_at,
  }
}

/**
 * Normalize and validate a snapshot. Field order in the returned object is the
 * documented hash order; canonicalization sorts keys anyway, so both must agree.
 */
export function buildFinancialSnapshot(input: RwaFinancialSnapshot): RwaFinancialSnapshot {
  if (input.snapshot_version !== RWA_SNAPSHOT_VERSION) {
    fail(`snapshot_version must be ${RWA_SNAPSHOT_VERSION}`)
  }
  if (!input.deal_id) fail('deal_id is required')
  if (!['testnet', 'futurenet', 'mainnet'].includes(input.network)) {
    fail('network must be testnet, futurenet or mainnet')
  }
  if (!input.asset_code) fail('asset_code is required')
  if (!input.asset_issuer) fail('asset_issuer is required')
  if (!Number.isInteger(input.asset_decimals) || input.asset_decimals < 0 || input.asset_decimals > 18) {
    fail('asset_decimals must be an integer between 0 and 18')
  }
  if (!Number.isInteger(input.term_days) || input.term_days < 1) {
    fail('term_days must be a positive integer')
  }
  if (input.maturity_policy !== 'delivery_relative') {
    fail('maturity_policy must be delivery_relative')
  }
  if (!RFC3339_UTC_PATTERN.test(input.issued_at)) {
    fail('issued_at must be RFC 3339 UTC ending in Z')
  }
  if (!input.issuance_identity) fail('issuance_identity is required')

  const principal = toAtomicString(input.principal_atomic, 'principal_atomic')
  const numerator = toAtomicString(input.return_numerator, 'return_numerator')
  const denominator = toAtomicString(input.return_denominator, 'return_denominator')

  if (BigInt(principal) <= BigInt(0)) fail('principal_atomic must be positive')
  if (BigInt(denominator) <= BigInt(0)) fail('return_denominator must be positive')
  if (BigInt(numerator) >= BigInt(denominator)) {
    fail('return_numerator must be smaller than return_denominator')
  }
  if (!Number.isInteger(input.display_yield_bps) || input.display_yield_bps < 0 || input.display_yield_bps > 9999) {
    fail('display_yield_bps must be an integer between 0 and 9999')
  }

  return {
    snapshot_version: RWA_SNAPSHOT_VERSION,
    deal_id: input.deal_id,
    network: input.network,
    asset_code: input.asset_code,
    asset_issuer: input.asset_issuer,
    asset_decimals: input.asset_decimals,
    principal_atomic: principal,
    return_numerator: numerator,
    return_denominator: denominator,
    display_yield_bps: input.display_yield_bps,
    term_days: input.term_days,
    maturity_policy: input.maturity_policy,
    fees: validateFees(input.fees),
    issued_at: input.issued_at,
    issuance_identity: input.issuance_identity,
  }
}

export function buildDocumentCommitment(input: RwaDocumentCommitment): RwaDocumentCommitment {
  if (!input.doc_kind) fail('doc_kind is required')
  if (!HEX64_PATTERN.test(input.content_hash)) {
    fail('content_hash must be 64 lowercase hex characters')
  }
  const byteLength = toAtomicString(input.byte_length, 'byte_length')
  if (BigInt(byteLength) <= BigInt(0)) fail('byte_length must be positive')

  return {
    doc_kind: input.doc_kind,
    content_hash: input.content_hash,
    byte_length: byteLength,
    canonicalization: input.canonicalization,
  }
}

/**
 * Entitlement in units for a contribution. Exact integer math: units are atomic principal
 * at the position scale, so display basis points can never change what an investor owns.
 */
function powerOfTen(exponent: number): bigint {
  // A loop instead of `10n ** x`: this project targets ES6, so bigint literals and the
  // exponentiation operator are unavailable to the type checker.
  let result = BigInt(1)
  for (let i = 0; i < exponent; i += 1) {
    result *= BigInt(10)
  }
  return result
}

export function unitsForContribution(confirmedPrincipalAtomic: bigint, unitDecimals = 0): bigint {
  if (confirmedPrincipalAtomic <= BigInt(0)) fail('confirmed principal must be positive')
  if (!Number.isInteger(unitDecimals) || unitDecimals < 0 || unitDecimals > 7) {
    fail('unit_decimals must be an integer between 0 and 7')
  }
  return confirmedPrincipalAtomic * powerOfTen(unitDecimals)
}
