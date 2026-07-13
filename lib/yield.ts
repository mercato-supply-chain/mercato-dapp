import { normalizeUSDC } from '@/lib/format'

/**
 * Calculates the investor yield rate (%) based on deal term and amount.
 * Longer terms and smaller deals typically have higher rates.
 * This is a flat rate for the deal term (not annualized), capped at 10%.
 */
export function calculateYieldAPR(termDays: number, amount: number): number {
  const days = Math.max(30, Math.min(90, termDays))
  // Rate from term: 5% at 30 days → 10% at 90 days
  const baseRate = 5 + ((days - 30) / 60) * 5
  // Volume discount: larger deals get slightly better rates
  const discount =
    amount >= 100_000 ? 2 : amount >= 50_000 ? 1 : amount >= 20_000 ? 0.5 : 0
  const rate = Math.max(0, baseRate - discount)
  // Hard cap at 10%
  return Math.round(Math.min(10, rate) * 100) / 100
}

/** Max extra rate (percentage points) a PyME may add on top of the base rate. */
export const MAX_YIELD_BONUS_APR = 10

/**
 * Clamps the PyME-offered bonus rate to a safe range (0–MAX_YIELD_BONUS_APR).
 */
export function clampYieldBonusApr(bonus: number): number {
  if (!Number.isFinite(bonus)) return 0
  return (
    Math.round(Math.max(0, Math.min(MAX_YIELD_BONUS_APR, bonus)) * 100) / 100
  )
}

/**
 * Total investor rate: base (from term + amount) plus optional PyME bonus.
 */
export function effectiveInvestorApr(baseAPR: number, bonusApr: number): number {
  return Math.round((baseAPR + bonusApr) * 100) / 100
}

/**
 * Expected investor earnings in USDC for a deal.
 * Flat rate over the deal term: amount × (rate / 100).
 */
export function calculateYieldAmount(
  amount: number,
  termDays: number,
  rate?: number
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const yieldRate = rate ?? calculateYieldAPR(termDays, amount)
  if (!Number.isFinite(yieldRate) || yieldRate <= 0) return 0
  return normalizeUSDC(amount * (yieldRate / 100))
}
