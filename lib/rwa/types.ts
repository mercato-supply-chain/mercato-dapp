/**
 * lib/rwa/types.ts
 *
 * Typed read model for Real-World Asset (RWA) partial-funding lifecycle.
 * These types expose the distinct facts about an RWA credit asset without
 * conflating partial contributions with full funding or supplier settlement.
 *
 * Key principle: a partial contribution is NEVER shown as supplier-paid or
 * shipment-ready until the full financing target is confirmed.
 */

/** Lifecycle phase of an RWA credit asset from investor perspective. */
export type RwaPositionStatus =
  | 'pending'        // Contribution initiated but not confirmed on-chain
  | 'confirmed'      // Contribution confirmed; deal may still be partially funded
  | 'target_reached' // Full financing target met; supplier settlement pending
  | 'supplier_paid'  // Supplier has received full invoice amount
  | 'partially_repaid' // Some repayment milestones released to investor
  | 'refundable'     // Contribution eligible for refund (e.g. deal expired)
  | 'redeemed'       // Investor has claimed full principal + return
  | 'expired'        // Funding window closed without reaching target
  | 'failed'         // Transaction failed; no capital at risk

/**
 * Frozen economic terms locked at the time the financing deal was created.
 * These never change once a contribution has been confirmed.
 */
export interface RwaCreditTerms {
  /** Supplier invoice amount (principal basis). */
  targetPrincipal: number
  /** Total financing target investors must collectively fund. */
  financingTarget: number
  /** Annual percentage rate for investor return calculation. */
  yieldApr: number
  /** Deal term in days. */
  termDays: number
  /** Platform fee percent (e.g. 1). */
  platformFeePercent: number
  /** ISO-8601 string when the funding window expires. */
  fundingExpiresAt: string | null
}

/**
 * Current capacity state of the deal's RWA funding pool.
 * Refreshed before preparing a contribution transaction.
 */
export interface RwaCapacityState {
  /** Total financing target. */
  target: number
  /** Sum of all confirmed contributions. */
  confirmedPrincipal: number
  /** Remaining capacity: target - confirmedPrincipal. */
  remainingCapacity: number
  /** Whether the target has been fully reached. */
  targetReached: boolean
  /** ISO-8601 timestamp when capacity was last fetched. */
  fetchedAt: string
}

/**
 * An individual investor's confirmed RWA position.
 * Uses only this investor's confirmed records — never the whole-deal amount.
 */
export interface RwaInvestorPosition {
  /** Unique position identifier (deal_id + investor_id composite). */
  id: string
  dealId: string
  investorId: string

  /** Investor's confirmed principal (not the full deal amount). */
  confirmedPrincipal: number
  /** Investor's share of the total financing target (0–1). */
  shareOfTarget: number
  /** Funding fee this investor paid (1% of their principal). */
  fundingFeeAmount: number
  /** Total wallet debit: confirmedPrincipal + fundingFeeAmount. */
  totalWalletDebit: number
  /** Estimated units/tokens corresponding to this contribution. */
  estimatedUnits: number | null

  /** Contractual return estimate for this investor's principal + APR + term. */
  estimatedReturnAmount: number
  /** Total expected payout at maturity: principal + return. */
  estimatedPayoutAtMaturity: number

  /** Amount settled and released to this investor so far. */
  confirmedSettled: number
  /** Outstanding amount still due: estimatedPayoutAtMaturity - confirmedSettled. */
  outstanding: number

  /** On-chain transaction hash for the funding payment. */
  fundingTxHash: string | null
  /** On-chain transaction hash(es) for received repayment(s). */
  payoutTxHashes: string[]

  status: RwaPositionStatus
  /** ISO-8601 timestamp when the position was created. */
  createdAt: string
  /** ISO-8601 timestamp of most recent status update. */
  updatedAt: string
}

/**
 * Per-investor contribution breakdown shown in the funding review UI.
 * All values are computed from canonical domain math, never from
 * formatted currency strings.
 */
export interface RwaContributionPreview {
  /** Raw principal entered by investor (exact decimal, not formatted). */
  principalRaw: number
  /** Platform fee (1% of principalRaw). */
  platformFeeAmount: number
  /** Total wallet debit: principalRaw + platformFeeAmount. */
  totalWalletDebit: number
  /** Investor's share of the financing target (0–1). */
  shareOfTarget: number
  /** Estimated units/tokens for this contribution. */
  estimatedUnits: number | null
  /** Estimated return amount at maturity (principal × APR × term/365). */
  estimatedReturnAmount: number
  /** Total estimated payout: principal + estimated return. */
  estimatedPayoutAtMaturity: number
  /** Whether this contribution would fill the remaining capacity exactly. */
  fillsTarget: boolean
  /** Remaining capacity AFTER this contribution. */
  remainingAfter: number
  /** Snapshot of capacity used to compute this preview. */
  capacitySnapshot: RwaCapacityState
}

/**
 * Validated contribution input.
 * Separates parsing errors from business-rule errors.
 */
export type RwaContributionInputError =
  | 'empty'
  | 'invalid_format'
  | 'too_many_decimals'    // More than 7 decimal places (USDC max)
  | 'below_minimum'        // Below the minimum contribution
  | 'exceeds_capacity'     // Would exceed remaining capacity
  | 'exceeds_balance'      // Investor wallet balance insufficient
  | 'capacity_stale'       // Capacity state is too old — refresh required
  | 'terms_changed'        // Deal terms changed since review started

export interface RwaContributionValidation {
  valid: boolean
  principalRaw: number | null
  error: RwaContributionInputError | null
}
