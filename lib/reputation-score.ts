/**
 * Unified reputation score computation for both investors and SMEs.
 *
 * Score range: 0–100
 * Formula weights:
 *   - Capital committed  : 30 pts max  (log-scaled, saturates at $100k)
 *   - Deals completed    : 30 pts max  (linear, saturates at 10 deals)
 *   - Repayment perf.    : 40 pts max  (0–1 ratio × 40)
 *   - Stake bonus        :  0–10 pts   (additive, log-scaled, saturates at $10k)
 *
 * Total max: 110 pts, but capped at 100 in the final score.
 */

export interface ReputationScoreInput {
  /** Total capital committed / deployed in USDC */
  capitalCommitted: number
  /** Number of deals fully completed */
  dealsCompleted: number
  /** Number of deals that were ever funded (denominator for repayment rate) */
  dealsFunded: number
  /** Stake amount in USDC (skin-in-the-game signal) */
  stakeAmount: number
}

export interface ReputationScoreBreakdown {
  capitalScore: number
  dealsScore: number
  repaymentScore: number
  stakeBonus: number
  total: number
}

const CAPITAL_MAX = 30
const CAPITAL_SATURATES_AT = 100_000

const DEALS_MAX = 30
const DEALS_SATURATES_AT = 10

const REPAYMENT_MAX = 40

const STAKE_BONUS_MAX = 10
const STAKE_SATURATES_AT = 10_000

/** log-based scaling: reaches ~50% of max at 10% of saturation point */
function logScale(value: number, saturatesAt: number): number {
  if (value <= 0) return 0
  return Math.min(1, Math.log1p(value) / Math.log1p(saturatesAt))
}

/** linear scaling capped at 1 */
function linearScale(value: number, saturatesAt: number): number {
  if (value <= 0 || saturatesAt <= 0) return 0
  return Math.min(1, value / saturatesAt)
}

export function computeReputationScore(input: ReputationScoreInput): ReputationScoreBreakdown {
  const { capitalCommitted, dealsCompleted, dealsFunded, stakeAmount } = input

  const repaymentRate = dealsFunded > 0 ? Math.min(1, dealsCompleted / dealsFunded) : 0

  const capitalScore = Math.round(logScale(capitalCommitted, CAPITAL_SATURATES_AT) * CAPITAL_MAX)
  const dealsScore = Math.round(linearScale(dealsCompleted, DEALS_SATURATES_AT) * DEALS_MAX)
  const repaymentScore = Math.round(repaymentRate * REPAYMENT_MAX)
  const stakeBonus = Math.round(logScale(stakeAmount, STAKE_SATURATES_AT) * STAKE_BONUS_MAX)

  const total = Math.min(100, capitalScore + dealsScore + repaymentScore + stakeBonus)

  return { capitalScore, dealsScore, repaymentScore, stakeBonus, total }
}

export type TrustLabel =
  | 'new'
  | 'building'
  | 'established'
  | 'trusted'
  | 'top_performer'

export interface TrustTier {
  label: TrustLabel
  displayLabel: string
  minScore: number
  color: string
  dotClass: string
}

export const TRUST_TIERS: TrustTier[] = [
  { label: 'new', displayLabel: 'New', minScore: 0, color: 'text-muted-foreground', dotClass: 'bg-muted-foreground/40' },
  { label: 'building', displayLabel: 'Building', minScore: 10, color: 'text-amber-600 dark:text-amber-400', dotClass: 'bg-amber-500' },
  { label: 'established', displayLabel: 'Established', minScore: 30, color: 'text-blue-600 dark:text-blue-400', dotClass: 'bg-blue-500' },
  { label: 'trusted', displayLabel: 'Trusted', minScore: 55, color: 'text-violet-600 dark:text-violet-400', dotClass: 'bg-violet-500' },
  { label: 'top_performer', displayLabel: 'Top Performer', minScore: 80, color: 'text-emerald-600 dark:text-emerald-400', dotClass: 'bg-emerald-500' },
]

export function getTrustTier(score: number): TrustTier {
  const sorted = [...TRUST_TIERS].sort((a, b) => b.minScore - a.minScore)
  return sorted.find((t) => score >= t.minScore) ?? TRUST_TIERS[0]
}

export function getTrustLabel(score: number): TrustLabel {
  return getTrustTier(score).label
}
