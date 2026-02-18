/**
 * PYME reputation: derived from repayment behavior to boost investor trust.
 * Circle: PYME opens order → investor funds → PYME receives product → PYME pays debt.
 * We score based on debt paid (completed deals) and current debt (in progress).
 */

export interface PymeReputationStats {
  /** Total amount repaid (deals with status = completed) */
  totalRepaid: number
  /** Current debt (deals funded or in progress, not yet completed) */
  currentDebt: number
  /** Number of deals fully repaid (completed) */
  dealsCompleted: number
  /** Number of deals that ever received funding (funded, in_progress, or completed) */
  dealsFunded: number
  /** Deals cancelled (after or before funding) */
  dealsCancelled: number
}

export type PymeReputationTier =
  | 'new'
  | 'building'
  | 'established'
  | 'top_performer'

export interface PymeReputation {
  stats: PymeReputationStats
  /** Completion rate: dealsCompleted / dealsFunded (0–1), or 0 if none funded */
  completionRate: number
  tier: PymeReputationTier
  /** Short label for badges and lists */
  label: string
  /** Optional short description for tooltip or detail page */
  description: string
}

const TIER_LABELS: Record<PymeReputationTier, string> = {
  new: 'New',
  building: 'Building track record',
  established: 'Established',
  top_performer: 'Top performer',
}

const TIER_DESCRIPTIONS: Record<PymeReputationTier, string> = {
  new: 'No funded deals yet.',
  building:
    'Has funded deals in progress. Reputation grows as they complete repayments.',
  established:
    'Has completed at least one deal. Shows consistent repayment behavior.',
  top_performer:
    'Multiple deals completed and significant amount repaid. Strong track record for investors.',
}

/** Minimum completed deals or total repaid (USD) to be "top performer" */
const TOP_PERFORMER_MIN_DEALS = 2
const TOP_PERFORMER_MIN_REPAID = 20_000

/**
 * Compute reputation from aggregated deal stats (status + amount per deal).
 * Use this with deal rows for one PYME or with pre-aggregated stats.
 */
export function computePymeReputation(stats: PymeReputationStats): PymeReputation {
  const dealsFunded = stats.dealsFunded || 0
  const completionRate =
    dealsFunded > 0 ? Math.min(1, stats.dealsCompleted / dealsFunded) : 0

  let tier: PymeReputationTier = 'new'
  if (dealsFunded === 0) {
    tier = 'new'
  } else if (stats.dealsCompleted === 0) {
    tier = 'building'
  } else if (
    stats.dealsCompleted >= TOP_PERFORMER_MIN_DEALS ||
    stats.totalRepaid >= TOP_PERFORMER_MIN_REPAID
  ) {
    tier = 'top_performer'
  } else {
    tier = 'established'
  }

  return {
    stats,
    completionRate,
    tier,
    label: TIER_LABELS[tier],
    description: TIER_DESCRIPTIONS[tier],
  }
}

/**
 * Aggregate deal rows (from DB) into PymeReputationStats.
 * Pass deals for a single PYME (e.g. from deals where pyme_id = X).
 */
export function aggregateDealsToStats(
  deals: { status: string; amount: number }[]
): PymeReputationStats {
  let totalRepaid = 0
  let currentDebt = 0
  let dealsCompleted = 0
  let dealsFunded = 0
  let dealsCancelled = 0

  for (const d of deals) {
    const amount = Number(d.amount) || 0
    const status = (d.status || '').toLowerCase()

    switch (status) {
      case 'completed':
        totalRepaid += amount
        dealsCompleted += 1
        dealsFunded += 1
        break
      case 'funded':
      case 'in_progress':
        currentDebt += amount
        dealsFunded += 1
        break
      case 'cancelled':
        dealsCancelled += 1
        break
      default:
        break
    }
  }

  return {
    totalRepaid,
    currentDebt,
    dealsCompleted,
    dealsFunded,
    dealsCancelled,
  }
}
