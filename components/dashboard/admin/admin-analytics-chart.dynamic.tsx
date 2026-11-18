'use client'

import dynamic from 'next/dynamic'
import type { AdminAnalyticsChartProps } from '@/components/dashboard/admin/admin-analytics-chart'

/**
 * Lazily loaded analytics comparison chart.
 *
 * The chart sits below the metric tiles and its numbers are duplicated in the
 * accessible data table underneath, so deferring it keeps the initial route
 * JS small without losing information. Recharts is package-optimized via
 * `experimental.optimizePackageImports` and only this split chunk pulls it.
 */
export const LazyAdminAnalyticsChart = dynamic<AdminAnalyticsChartProps>(
  () =>
    import('@/components/dashboard/admin/admin-analytics-chart').then(
      (mod) => mod.AdminAnalyticsChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="h-48 w-full animate-pulse rounded-xl bg-muted"
      />
    ),
  },
)
