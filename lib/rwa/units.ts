/**
 * Conversion between display amounts and on-chain base units.
 *
 * The funding contract works in integer base units. Amounts arrive from
 * clients as decimal numbers, so the conversion goes through strings: a float
 * round trip would silently change the amount the investor signed.
 *
 * BigInt literals and the `**` operator are avoided on purpose: the project
 * targets ES6, where neither is available.
 */

/** Maximum decimals the registry accepts (USDC on Stellar uses 7). */
export const MAX_TOKEN_DECIMALS = 18

const TEN = BigInt(10)
const ZERO = BigInt(0)
const ONE = BigInt(1)

/** 10^decimals, computed without exponentiation. */
function scaleFor(decimals: number): bigint {
  let scale = ONE
  for (let i = 0; i < decimals; i++) scale *= TEN
  return scale
}

/**
 * Convert a decimal amount into integer base units.
 *
 * Throws when the amount has more precision than the token supports, because
 * rounding up would charge the investor more than they asked for and rounding
 * down would change the signed amount.
 */
export function amountToUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be a finite number')
  }
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_TOKEN_DECIMALS) {
    throw new Error('Invalid token decimals')
  }

  assertRepresentable(amount, decimals)

  // Use the shortest round-trippable decimal representation.
  const text = amount.toFixed(decimals)
  const [whole, fraction = ''] = text.split('.')

  const units = BigInt(whole) * scaleFor(decimals) + BigInt(fraction || '0')
  if (units <= ZERO) {
    throw new Error('Amount must be greater than zero')
  }
  return units
}

/**
 * Reject an amount that carries more precision than the token supports.
 *
 * `toFixed` would silently round the amount, which would change the number the
 * investor signs, so the check is done against the shortest representation of
 * the value instead.
 */
function assertRepresentable(amount: number, decimals: number): void {
  const text = String(amount)

  if (text.includes('e') || text.includes('E')) {
    // Exponential notation: the value is only representable when it survives
    // an extra decimal place unchanged.
    if (Number(amount.toFixed(decimals + 1)) !== amount) {
      throw new Error('Amount has more precision than the token supports')
    }
    return
  }

  const [, fraction = ''] = text.split('.')
  if (fraction.length > decimals) {
    throw new Error('Amount has more precision than the token supports')
  }
}

/** Convert integer base units back into a decimal amount. */
export function unitsToAmount(units: bigint, decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_TOKEN_DECIMALS) {
    throw new Error('Invalid token decimals')
  }
  return Number(formatUnits(units, decimals))
}

/** Format base units for display without going through a float first. */
export function formatUnits(units: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_TOKEN_DECIMALS) {
    throw new Error('Invalid token decimals')
  }
  const negative = units < ZERO
  const absolute = negative ? -units : units
  const scale = scaleFor(decimals)
  const whole = absolute / scale
  const fraction = absolute % scale
  const text =
    decimals === 0
      ? whole.toString()
      : `${whole}.${fraction.toString().padStart(decimals, '0')}`
  return negative ? `-${text}` : text
}
