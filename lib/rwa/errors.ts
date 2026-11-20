/**
 * Stable error codes for the RWA contribution API.
 *
 * The codes are part of the API contract: clients branch on them, so they must
 * not change meaning. Each code maps to exactly one HTTP status.
 */

export const RWA_ERROR_CODES = {
  /** No authenticated session. */
  UNAUTHENTICATED: 'rwa_unauthenticated',
  /** Session is valid but the role may not perform this action. */
  FORBIDDEN: 'rwa_forbidden',
  /** The request body failed schema validation. */
  INVALID_REQUEST: 'rwa_invalid_request',
  /** The referenced asset does not exist. */
  ASSET_NOT_FOUND: 'rwa_asset_not_found',
  /** The asset is not accepting contributions (not open, past deadline). */
  ASSET_NOT_OPEN: 'rwa_asset_not_open',
  /** The wallet is not verified/associated with the authenticated investor. */
  WALLET_NOT_AUTHORIZED: 'rwa_wallet_not_authorized',
  /** The amount is not a positive integer number of base units. */
  INVALID_AMOUNT: 'rwa_invalid_amount',
  /** The pool does not have enough remaining capacity for this contribution. */
  INSUFFICIENT_CAPACITY: 'rwa_insufficient_capacity',
  /** The funding deadline has passed. */
  FUNDING_EXPIRED: 'rwa_funding_expired',
  /** The attempt could not be found. */
  ATTEMPT_NOT_FOUND: 'rwa_attempt_not_found',
  /** The contribution was already confirmed. */
  ALREADY_CONFIRMED: 'rwa_already_confirmed',
  /** The observed receipt does not match the reserved intent. */
  RECEIPT_MISMATCH: 'rwa_receipt_mismatch',
  /** The receipt was already used for a different contribution. */
  RECEIPT_CONFLICT: 'rwa_receipt_conflict',
  /** The on-chain transaction was not found. */
  TRANSACTION_NOT_FOUND: 'rwa_transaction_not_found',
  /** The on-chain transaction did not succeed. */
  TRANSACTION_FAILED: 'rwa_transaction_failed',
  /** The expected funding-contract event was not emitted. */
  EVENT_NOT_FOUND: 'rwa_event_not_found',
  /** The event did not come from the expected contract/network. */
  WRONG_CONTRACT: 'rwa_wrong_contract',
  /** The event came from a different network than the configured one. */
  WRONG_NETWORK: 'rwa_wrong_network',
  /** The event references a different asset than the reserved intent. */
  WRONG_ASSET: 'rwa_wrong_asset',
  /** The asset is not denominated in the expected token. */
  WRONG_TOKEN: 'rwa_wrong_token',
  /** The event references a different investor than the reserved intent. */
  WRONG_INVESTOR: 'rwa_wrong_investor',
  /** The event principal does not match the reserved intent. */
  WRONG_PRINCIPAL: 'rwa_wrong_principal',
  /** The event nonce does not match the reserved intent. */
  WRONG_NONCE: 'rwa_wrong_nonce',
  /** The contribution reference does not match the reserved intent. */
  WRONG_REFERENCE: 'rwa_wrong_reference',
  /** The observed position id does not match the expected one. */
  POSITION_MISMATCH: 'rwa_position_mismatch',
  /** The chain state is not usable yet; retry or reconcile. */
  STATE_UNAVAILABLE: 'rwa_state_unavailable',
  /** The target has not been reached, so settlement is not allowed. */
  TARGET_NOT_REACHED: 'rwa_target_not_reached',
  /** An unexpected server failure. */
  INTERNAL: 'rwa_internal',
} as const

export type RwaErrorCode = (typeof RWA_ERROR_CODES)[keyof typeof RWA_ERROR_CODES]

const HTTP_STATUS: Record<RwaErrorCode, number> = {
  [RWA_ERROR_CODES.UNAUTHENTICATED]: 401,
  [RWA_ERROR_CODES.FORBIDDEN]: 403,
  [RWA_ERROR_CODES.INVALID_REQUEST]: 400,
  [RWA_ERROR_CODES.ASSET_NOT_FOUND]: 404,
  [RWA_ERROR_CODES.ASSET_NOT_OPEN]: 409,
  [RWA_ERROR_CODES.WALLET_NOT_AUTHORIZED]: 403,
  [RWA_ERROR_CODES.INVALID_AMOUNT]: 400,
  [RWA_ERROR_CODES.INSUFFICIENT_CAPACITY]: 409,
  [RWA_ERROR_CODES.FUNDING_EXPIRED]: 409,
  [RWA_ERROR_CODES.ATTEMPT_NOT_FOUND]: 404,
  [RWA_ERROR_CODES.ALREADY_CONFIRMED]: 409,
  [RWA_ERROR_CODES.RECEIPT_MISMATCH]: 409,
  [RWA_ERROR_CODES.RECEIPT_CONFLICT]: 409,
  [RWA_ERROR_CODES.TRANSACTION_NOT_FOUND]: 404,
  [RWA_ERROR_CODES.TRANSACTION_FAILED]: 409,
  [RWA_ERROR_CODES.EVENT_NOT_FOUND]: 409,
  [RWA_ERROR_CODES.WRONG_CONTRACT]: 409,
  [RWA_ERROR_CODES.WRONG_NETWORK]: 409,
  [RWA_ERROR_CODES.WRONG_ASSET]: 409,
  [RWA_ERROR_CODES.WRONG_TOKEN]: 409,
  [RWA_ERROR_CODES.WRONG_INVESTOR]: 403,
  [RWA_ERROR_CODES.WRONG_PRINCIPAL]: 409,
  [RWA_ERROR_CODES.WRONG_NONCE]: 409,
  [RWA_ERROR_CODES.WRONG_REFERENCE]: 409,
  [RWA_ERROR_CODES.POSITION_MISMATCH]: 409,
  [RWA_ERROR_CODES.STATE_UNAVAILABLE]: 503,
  [RWA_ERROR_CODES.TARGET_NOT_REACHED]: 409,
  [RWA_ERROR_CODES.INTERNAL]: 500,
}

/** Machine-readable failure with a stable code. */
export class RwaError extends Error {
  readonly code: RwaErrorCode
  readonly status: number
  /** Extra machine-readable context (current capacity, lifecycle, ...). */
  readonly details: Record<string, unknown>

  constructor(
    code: RwaErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'RwaError'
    this.code = code
    this.status = HTTP_STATUS[code] ?? 500
    this.details = details
  }

  toJSON() {
    return { error: this.code, message: this.message, ...this.details }
  }
}

export function httpStatusForRwaCode(code: RwaErrorCode): number {
  return HTTP_STATUS[code] ?? 500
}

/**
 * Map a Postgres error raised by the protected RWA operations onto a stable
 * code. The operations raise `errcode = '22023'` with a `detail`/`message`
 * prefix that identifies the reason.
 */
export function rwaCodeFromDatabaseError(error: {
  code?: string
  message?: string
}): RwaErrorCode {
  const message = (error.message ?? '').toLowerCase()

  if (error.code === '42501') return RWA_ERROR_CODES.FORBIDDEN
  if (error.code === 'P0002') return RWA_ERROR_CODES.ATTEMPT_NOT_FOUND
  if (error.code === '23505') return RWA_ERROR_CODES.RECEIPT_CONFLICT

  if (message.includes('insufficient_capacity')) {
    return RWA_ERROR_CODES.INSUFFICIENT_CAPACITY
  }
  if (message.includes('asset_not_found')) return RWA_ERROR_CODES.ASSET_NOT_FOUND
  if (message.includes('asset_not_open')) return RWA_ERROR_CODES.ASSET_NOT_OPEN
  if (message.includes('funding_expired')) return RWA_ERROR_CODES.FUNDING_EXPIRED
  if (message.includes('receipt_mismatch')) return RWA_ERROR_CODES.RECEIPT_MISMATCH
  if (message.includes('receipt_conflict')) return RWA_ERROR_CODES.RECEIPT_CONFLICT
  if (message.includes('target_exceeded')) return RWA_ERROR_CODES.INSUFFICIENT_CAPACITY
  if (message.includes('target_not_reached')) return RWA_ERROR_CODES.TARGET_NOT_REACHED
  if (message.includes('position_mismatch')) return RWA_ERROR_CODES.POSITION_MISMATCH
  if (message.includes('nonce_regression')) return RWA_ERROR_CODES.WRONG_NONCE
  if (message.includes('invalid_amount')) return RWA_ERROR_CODES.INVALID_AMOUNT
  if (message.includes('attempt_not_found')) return RWA_ERROR_CODES.ATTEMPT_NOT_FOUND

  return RWA_ERROR_CODES.INTERNAL
}

/**
 * Extract the remaining capacity advertised alongside an
 * `insufficient_capacity` failure, so the API can return actionable state
 * without a second round trip.
 */
export function capacityFromDatabaseError(error: {
  message?: string
}): number | null {
  const match = /insufficient_capacity:(-?\d+)/.exec(error.message ?? '')
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}
