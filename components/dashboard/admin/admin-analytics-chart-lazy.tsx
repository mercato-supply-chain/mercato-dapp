'use client'

import dynamic from 'next/dynamic'

import type { AnalyticsChartRow } from './admin-analytics-chart'

/**
 * Lazy boundary for the Recharts comparison chart.
 *
 * Recharts is a large, client-only dependency and this chart sits below the
 * metrics grid on the admin analytics page. `dynamic()` gives it its own client
 * chunk and `ssr: false` keeps it out of the server render entirely, so the
 * metrics, deltas, snapshot lists and the accessible table paint without
 * waiting on the chart bundle.
 *
 * `AnalyticsChartRow` is a type-only import: it is erased at compile time and
 * does not pull `admin-analytics-chart` (or Recharts) into this module's chunk.
 */
const AdminAnalyticsChart = dynamic(
  () => import('./admin-analytics-chart').then((mod) => mod.AdminAnalyticsChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-48 w-full animate-pulse rounded-lg border border-border/60 bg-muted/40"
        aria-hidden
      />
    ),
  },
)

type AdminAnalyticsChartLazyProps = {
  rows: AnalyticsChartRow[]
  ariaLabelKey: string
}

/** Same props as `AdminAnalyticsChart`, loaded on the client after first paint. */
export function AdminAnalyticsChartLazy({ rows, ariaLabelKey }: AdminAnalyticsChartLazyProps) {
  return <AdminAnalyticsChart rows={rows} ariaLabelKey={ariaLabelKey} />
}
