import { getDefindexAssetDecimals } from './client-config'

/** Parse on-chain raw token amounts from API JSON (number, string, or bigint-like). */
export function parseRawTokenAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return 0
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export type ParsedVaultBalance = {
  dfTokensRaw: number
  underlyingRawPerAsset: number[]
  underlyingTotalRaw: number
  underlyingTotalDisplay: number
}

/** Normalize DeFindex vault balance payloads (camelCase or snake_case, string or number raw units). */
export function parseVaultBalancePayload(raw: unknown): ParsedVaultBalance {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const dfTokensRaw = parseRawTokenAmount(obj.dfTokens ?? obj.df_tokens)

  const underlyingField = obj.underlyingBalance ?? obj.underlying_balance
  const underlyingRawPerAsset = Array.isArray(underlyingField)
    ? underlyingField.map(parseRawTokenAmount)
    : []

  const underlyingTotalRaw = underlyingRawPerAsset.reduce((sum, amount) => sum + amount, 0)
  let resolvedUnderlyingRaw = underlyingRawPerAsset
  let resolvedTotalRaw = underlyingTotalRaw

  // Some indexer responses only include dfTokens immediately after a deposit.
  if (resolvedTotalRaw <= 0 && dfTokensRaw > 0) {
    resolvedUnderlyingRaw = [dfTokensRaw]
    resolvedTotalRaw = dfTokensRaw
  }

  const underlyingTotalDisplay = sumUnderlyingDisplayAmounts(resolvedUnderlyingRaw)

  return {
    dfTokensRaw,
    underlyingRawPerAsset: resolvedUnderlyingRaw,
    underlyingTotalRaw: resolvedTotalRaw,
    underlyingTotalDisplay,
  }
}

/** Convert raw vault underlying amounts (per asset) to a single display number. */
export function sumUnderlyingDisplayAmounts(rawPerAsset: number[]): number {
  if (!rawPerAsset?.length) return 0
  const decimals = getDefindexAssetDecimals()
  const scale = 10 ** decimals
  return rawPerAsset.reduce((sum, raw) => {
    if (!Number.isFinite(raw) || raw <= 0) return sum
    return sum + raw / scale
  }, 0)
}

/**
 * Convert on-chain raw units to a human display amount. Canonical converter — the
 * single "raw ÷ 10^decimals" implementation for the whole DeFindex integration
 * (server and client). Accepts string or number raw units.
 */
export function rawToDisplayAmount(
  raw: string | number,
  decimals = getDefindexAssetDecimals()
): number {
  const n = typeof raw === 'string' ? Number(raw) : raw
  if (!Number.isFinite(n)) return 0
  return n / 10 ** decimals
}

/**
 * Convert a human display amount (e.g. USDC) to on-chain raw units. Canonical
 * inverse of {@link rawToDisplayAmount}; non-positive/non-finite inputs → 0.
 */
export function displayToRawAmount(
  display: number,
  decimals = getDefindexAssetDecimals()
): number {
  if (!Number.isFinite(display) || display <= 0) return 0
  return Math.round(display * 10 ** decimals)
}
