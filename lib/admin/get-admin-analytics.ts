import type { SupabaseClient } from '@supabase/supabase-js'
import {
  conversionRate,
  previousPeriod,
  resolveRange,
  type AnalyticsRange,
} from './analytics-definitions'

export type MetricPair = { current: number | null; previous: number | null }

export type AdminUserAnalytics = {
  newUsers: MetricPair
  newPymes: MetricPair
  newInvestors: MetricPair
  newSuppliers: MetricPair
  onboardingCompleted: MetricPair
  /** Completed onboarding among the cohort created in the period. */
  cohortConversion: MetricPair
  medianCompletionSeconds: MetricPair
  snapshot: {
    totalUsers: number
    onboardingIncomplete: number
    onboardingCompleted: number
    onboardingCompletedLegacy: number
    verifiedUsers: number
    verifiedCompanies: number
    totalCompanies: number
    pymes: number
    investors: number
    suppliers: number
  }
}

export type AdminDealAnalytics = {
  dealsCreated: MetricPair
  requestedVolume: MetricPair
  dealsFunded: MetricPair
  fundedVolume: MetricPair
  fundingConversion: MetricPair
  avgTimeToFundingSeconds: MetricPair
  snapshot: {
    totalDeals: number
    seekingFunding: number
    funded: number
    inProgress: number
    completed: number
    activeDeals: number
    activeVolume: number
    completedVolume: number
  }
}

export type AdminRepaymentAnalytics = {
  escrowsCreated: MetricPair
  firstReleases: MetricPair
  avgDeliveryToEscrowSeconds: MetricPair
  avgReadyToReleaseSeconds: MetricPair
  snapshot: {
    awaitingEscrow: number
    awaitingFunding: number
    readyToRelease: number
    partiallyReleased: number
    released: number
    milestonesReleased: number
    milestonesOpen: number
    releasedVolume: number
  }
}

export type AdminAnalyticsData = {
  range: AnalyticsRange
  previous: { from: Date; to: Date }
  users: AdminUserAnalytics
  deals: AdminDealAnalytics
  repayments: AdminRepaymentAnalytics
}

type PeriodJson = Record<string, number | string | null> | null | undefined

type MetricsJson = {
  current?: PeriodJson
  previous?: PeriodJson
  snapshot?: PeriodJson
}

function num(period: PeriodJson, key: string): number | null {
  const value = period?.[key]
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function snapshotNum(period: PeriodJson, key: string): number {
  return num(period, key) ?? 0
}

function pair(json: MetricsJson, key: string): MetricPair {
  return { current: num(json.current, key), previous: num(json.previous, key) }
}

/**
 * Loads the three admin metric groups via server-side RPC aggregates.
 * Returns null when the RPCs are unavailable (e.g. migrations not applied).
 */
export async function getAdminAnalytics(
  supabase: SupabaseClient,
  rangeKey?: string | null,
  customFrom?: string | null,
  customTo?: string | null,
): Promise<AdminAnalyticsData | null> {
  const range = resolveRange(rangeKey, customFrom, customTo)
  const previous = previousPeriod(range)

  const params = {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_prev_from: previous.from.toISOString(),
    p_prev_to: previous.to.toISOString(),
  }

  const [usersRes, dealsRes, repaymentsRes] = await Promise.all([
    supabase.rpc('admin_user_metrics', params),
    supabase.rpc('admin_deal_metrics', params),
    supabase.rpc('admin_repayment_metrics', params),
  ])

  if (usersRes.error || dealsRes.error || repaymentsRes.error) {
    return null
  }

  const users = (usersRes.data ?? {}) as MetricsJson
  const deals = (dealsRes.data ?? {}) as MetricsJson
  const repayments = (repaymentsRes.data ?? {}) as MetricsJson

  return {
    range,
    previous,
    users: {
      newUsers: pair(users, 'new_users'),
      newPymes: pair(users, 'new_pymes'),
      newInvestors: pair(users, 'new_investors'),
      newSuppliers: pair(users, 'new_suppliers'),
      onboardingCompleted: pair(users, 'onboarding_completed'),
      cohortConversion: {
        current: conversionRate(
          num(users.current, 'cohort_completed'),
          num(users.current, 'new_users'),
        ),
        previous: conversionRate(
          num(users.previous, 'cohort_completed'),
          num(users.previous, 'new_users'),
        ),
      },
      medianCompletionSeconds: pair(users, 'median_completion_seconds'),
      snapshot: {
        totalUsers: snapshotNum(users.snapshot, 'total_users'),
        onboardingIncomplete: snapshotNum(users.snapshot, 'onboarding_incomplete'),
        onboardingCompleted: snapshotNum(users.snapshot, 'onboarding_completed'),
        onboardingCompletedLegacy: snapshotNum(
          users.snapshot,
          'onboarding_completed_legacy',
        ),
        verifiedUsers: snapshotNum(users.snapshot, 'verified_users'),
        verifiedCompanies: snapshotNum(users.snapshot, 'verified_companies'),
        totalCompanies: snapshotNum(users.snapshot, 'total_companies'),
        pymes: snapshotNum(users.snapshot, 'pymes'),
        investors: snapshotNum(users.snapshot, 'investors'),
        suppliers: snapshotNum(users.snapshot, 'suppliers'),
      },
    },
    deals: {
      dealsCreated: pair(deals, 'deals_created'),
      requestedVolume: pair(deals, 'requested_volume'),
      dealsFunded: pair(deals, 'deals_funded'),
      fundedVolume: pair(deals, 'funded_volume'),
      fundingConversion: {
        current: conversionRate(
          num(deals.current, 'deals_funded'),
          num(deals.current, 'deals_created'),
        ),
        previous: conversionRate(
          num(deals.previous, 'deals_funded'),
          num(deals.previous, 'deals_created'),
        ),
      },
      avgTimeToFundingSeconds: pair(deals, 'avg_time_to_funding_seconds'),
      snapshot: {
        totalDeals: snapshotNum(deals.snapshot, 'total_deals'),
        seekingFunding: snapshotNum(deals.snapshot, 'seeking_funding'),
        funded: snapshotNum(deals.snapshot, 'funded'),
        inProgress: snapshotNum(deals.snapshot, 'in_progress'),
        completed: snapshotNum(deals.snapshot, 'completed'),
        activeDeals: snapshotNum(deals.snapshot, 'active_deals'),
        activeVolume: snapshotNum(deals.snapshot, 'active_volume'),
        completedVolume: snapshotNum(deals.snapshot, 'completed_volume'),
      },
    },
    repayments: {
      escrowsCreated: pair(repayments, 'escrows_created'),
      firstReleases: pair(repayments, 'first_releases'),
      avgDeliveryToEscrowSeconds: pair(repayments, 'avg_delivery_to_escrow_seconds'),
      avgReadyToReleaseSeconds: pair(repayments, 'avg_ready_to_release_seconds'),
      snapshot: {
        awaitingEscrow: snapshotNum(repayments.snapshot, 'awaiting_escrow'),
        awaitingFunding: snapshotNum(repayments.snapshot, 'awaiting_funding'),
        readyToRelease: snapshotNum(repayments.snapshot, 'ready_to_release'),
        partiallyReleased: snapshotNum(repayments.snapshot, 'partially_released'),
        released: snapshotNum(repayments.snapshot, 'released'),
        milestonesReleased: snapshotNum(repayments.snapshot, 'milestones_released'),
        milestonesOpen: snapshotNum(repayments.snapshot, 'milestones_open'),
        releasedVolume: snapshotNum(repayments.snapshot, 'released_volume'),
      },
    },
  }
}
