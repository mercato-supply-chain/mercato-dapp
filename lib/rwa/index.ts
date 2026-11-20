/**
 * lib/rwa/index.ts
 *
 * Public API for the RWA read model module.
 */

export type {
  RwaCapacityState,
  RwaContributionInputError,
  RwaContributionPreview,
  RwaContributionValidation,
  RwaCreditTerms,
  RwaInvestorPosition,
  RwaPositionStatus,
} from './types'

export {
  buildCapacityState,
  buildContributionPreview,
  computePositionMetrics,
  isCapacityStale,
  parseContributionInput,
  RWA_CAPACITY_STALE_MS,
  RWA_MINIMUM_CONTRIBUTION,
  validateContributionRules,
} from './capacity'
