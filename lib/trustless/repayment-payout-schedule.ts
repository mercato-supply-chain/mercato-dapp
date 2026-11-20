import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'

/**
 * A frozen payout tranche produced by the RWA position/entitlement ledger.
 * Amounts are integer USDC cents; this module never derives entitlements.
 */
export type RepaymentPayoutTranche = {
  readonly positionRef: string
  readonly receiver: string
  readonly grossAmountCents: number
  readonly netAmountCents: number
  readonly description?: string
}

export type RepaymentPayoutScheduleInput = {
  readonly tranches: readonly RepaymentPayoutTranche[]
  readonly totalGrossCents: number
  /**
   * Kept only to reject legacy single-investor overrides explicitly. RWA
   * positions must use an authorized wallet-change process instead.
   */
  readonly receiverOverride?: string
}

export type RepaymentPayoutMilestone = {
  readonly description: string
  readonly amount: number
  readonly receiver: string
}

export type RepaymentPayoutSchedule = {
  readonly milestones: readonly RepaymentPayoutMilestone[]
  readonly totalGrossCents: number
  readonly totalNetCents: number
  readonly positionRefs: readonly string[]
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function centsToAmount(cents: number): number {
  return cents / 100
}

/**
 * Validates an already-frozen tranche list and maps it to Trustless Work's
 * multi-release milestone shape. It is deliberately pure and does not compute
 * pro-rata entitlements, persist payouts, submit transactions, or claim
 * on-chain settlement.
 */
export function buildRepaymentPayoutSchedule(
  input: RepaymentPayoutScheduleInput,
): RepaymentPayoutSchedule {
  if (input.receiverOverride !== undefined) {
    throw new Error(
      'RWA payout schedules do not support receiver overrides; use an authorized wallet-change process',
    )
  }
  if (!isPositiveSafeInteger(input.totalGrossCents)) {
    throw new Error('Total gross amount must be a positive integer number of cents')
  }
  if (!Array.isArray(input.tranches) || input.tranches.length === 0) {
    throw new Error('At least one payout tranche is required')
  }

  const seenPositions = new Set<string>()
  let grossTotal = 0
  let netTotal = 0
  const milestones: RepaymentPayoutMilestone[] = []
  const positionRefs: string[] = []

  for (const [index, tranche] of input.tranches.entries()) {
    const positionRef = tranche.positionRef.trim()
    if (!positionRef) {
      throw new Error(`Tranche ${index + 1} is missing a position reference`)
    }
    if (seenPositions.has(positionRef)) {
      throw new Error(`Duplicate position reference: ${positionRef}`)
    }
    seenPositions.add(positionRef)
    positionRefs.push(positionRef)

    const receiver = tranche.receiver.trim()
    if (!isLikelyStellarAddress(receiver)) {
      throw new Error(`Tranche ${index + 1} receiver is not a valid Stellar address`)
    }
    if (!isPositiveSafeInteger(tranche.grossAmountCents)) {
      throw new Error(`Tranche ${index + 1} gross amount must be a positive integer number of cents`)
    }
    if (!isPositiveSafeInteger(tranche.netAmountCents)) {
      throw new Error(`Tranche ${index + 1} net amount must be a positive integer number of cents`)
    }
    if (tranche.netAmountCents > tranche.grossAmountCents) {
      throw new Error(`Tranche ${index + 1} net amount cannot exceed its gross amount`)
    }

    grossTotal += tranche.grossAmountCents
    netTotal += tranche.netAmountCents
    if (!Number.isSafeInteger(grossTotal) || !Number.isSafeInteger(netTotal)) {
      throw new Error('Payout amounts overflow the safe integer range')
    }

    milestones.push({
      description: tranche.description?.trim() || `Position ${positionRef} payout`,
      amount: centsToAmount(tranche.grossAmountCents),
      receiver,
    })
  }

  if (grossTotal !== input.totalGrossCents) {
    throw new Error(
      `Payout tranche total (${grossTotal} cents) does not match the frozen gross total (${input.totalGrossCents} cents)`,
    )
  }

  return {
    milestones,
    totalGrossCents: grossTotal,
    totalNetCents: netTotal,
    positionRefs,
  }
}
