/**
 * lib/rwa/capacity.ts
 *
 * Pure helpers for computing RWA capacity state and validating partial
 * contribution amounts. All math uses raw numbers (never formatted strings).
 */

import { normalizeUSDC } from '@/lib/format'
import {
  investorFundingTotal,
  platformFeeAmount,
} from '@/lib/deals/fees'
import { expectedYield } from '@/lib/investments/portfolio-metrics'
import type {
  RwaCapacityState,
  RwaContributionInputError,
  RwaContributionPreview,
  RwaContributionValidation,
  RwaCreditTerms,
} from './types'

/** Maximum decimal places accepted for USDC amounts. */
const USDC_MAX_DECIMALS = 7

/** Minimum contribution: 1 stroops in USDC (0.0000001). */
export const RWA_MINIMUM_CONTRIBUTION = 0.0000001

/**
 * Maximum age (ms) before a capacity snapshot is considered stale and must be
 * refreshed before a new contribution can be prepared.
 */
export const RWA_CAPACITY_STALE_MS = 30_000 // 30 seconds

/**
 * Build a capacity state from raw deal totals.
 * Caller is responsible for fetching current confirmed totals from Supabase.
 */
export function buildCapacityState(
  target: number,
  confirmedPrincipal: number,
): RwaCapacityState {
  const confirmed = Math.max(0, confirmedPrincipal)
  const remaining = normalizeUSDC(Math.max(0, target - confirmed))
  return {
    target,
    confirmedPrincipal: confirmed,
    remainingCapacity: remaining,
    targetReached: remaining === 0,
    fetchedAt: new Date().toISOString(),
  }
}

/**
 * Returns true if the capacity snapshot is older than RWA_CAPACITY_STALE_MS.
 */
export function isCapacityStale(capacity: RwaCapacityState): boolean {
  const age = Date.now() - new Date(capacity.fetchedAt).getTime()
  return age > RWA_CAPACITY_STALE_MS
}

/**
 * Parse a user-entered contribution string into a validated number.
 * Accepts decimal amounts up to USDC_MAX_DECIMALS places.
 * Returns null and an error code on any invalid input.
 */
export function parseContributionInput(raw: string): RwaContributionValidation {
  const trimmed = raw.trim()

  if (!trimmed) {
    return { valid: false, principalRaw: null, error: 'empty' }
  }

  // Allow only digits, one optional dot, and no other characters.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { valid: false, principalRaw: null, error: 'invalid_format' }
  }

  const dotIdx = trimmed.indexOf('.')
  if (dotIdx !== -1) {
    const decimalPart = trimmed.slice(dotIdx + 1)
    if (decimalPart.length > USDC_MAX_DECIMALS) {
      return { valid: false, principalRaw: null, error: 'too_many_decimals' }
    }
  }

  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0) {
    return { valid: false, principalRaw: null, error: 'invalid_format' }
  }

  return { valid: true, principalRaw: value, error: null }
}

/**
 * Validate a parsed principal against business rules.
 * Returns the first failing error or null if valid.
 */
export function validateContributionRules(
  principal: number,
  capacity: RwaCapacityState,
  walletBalance: number,
): RwaContributionInputError | null {
  if (isCapacityStale(capacity)) return 'capacity_stale'
  if (capacity.targetReached) return 'exceeds_capacity'
  if (principal < RWA_MINIMUM_CONTRIBUTION) return 'below_minimum'

  const rounded = normalizeUSDC(principal)
  if (rounded > capacity.remainingCapacity) return 'exceeds_capacity'

  const totalDebit = investorFundingTotal(principal)
  if (totalDebit > walletBalance) return 'exceeds_balance'

  return null
}

/**
 * Compute the full contribution preview from a valid principal amount.
 * All arithmetic is done with raw numbers — never formatted strings.
 */
export function buildContributionPreview(
  principal: number,
  terms: RwaCreditTerms,
  capacity: RwaCapacityState,
): RwaContributionPreview {
  const feeAmount = platformFeeAmount(principal)
  const totalWalletDebit = investorFundingTotal(principal)
  const shareOfTarget = capacity.target > 0 ? principal / capacity.target : 0
  const estimatedReturn = expectedYield(principal, terms.yieldApr, terms.termDays)
  const remainingAfter = normalizeUSDC(
    Math.max(0, capacity.remainingCapacity - normalizeUSDC(principal)),
  )

  return {
    principalRaw: principal,
    platformFeeAmount: feeAmount,
    totalWalletDebit,
    shareOfTarget,
    estimatedUnits: null, // Units/tokens not yet available without on-chain contract
    estimatedReturnAmount: estimatedReturn,
    estimatedPayoutAtMaturity: normalizeUSDC(principal + estimatedReturn),
    fillsTarget: remainingAfter === 0,
    remainingAfter,
    capacitySnapshot: capacity,
  }
}

/**
 * Build an RwaInvestorPosition-shaped metrics object from confirmed records.
 * Uses only per-investor confirmed numbers to prevent double-counting.
 */
export function computePositionMetrics(opts: {
  confirmedPrincipal: number
  target: number
  yieldApr: number
  termDays: number
  confirmedSettled: number
}): {
  shareOfTarget: number
  fundingFeeAmount: number
  totalWalletDebit: number
  estimatedReturnAmount: number
  estimatedPayoutAtMaturity: number
  outstanding: number
} {
  const { confirmedPrincipal, target, yieldApr, termDays, confirmedSettled } = opts
  const shareOfTarget = target > 0 ? confirmedPrincipal / target : 0
  const feeAmount = platformFeeAmount(confirmedPrincipal)
  const totalWalletDebit = investorFundingTotal(confirmedPrincipal)
  const estimatedReturn = expectedYield(confirmedPrincipal, yieldApr, termDays)
  const estimatedPayoutAtMaturity = normalizeUSDC(confirmedPrincipal + estimatedReturn)
  const outstanding = normalizeUSDC(Math.max(0, estimatedPayoutAtMaturity - confirmedSettled))

  return {
    shareOfTarget,
    fundingFeeAmount: feeAmount,
    totalWalletDebit,
    estimatedReturnAmount: estimatedReturn,
    estimatedPayoutAtMaturity,
    outstanding,
  }
}
