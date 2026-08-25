/**
 * Date-range and rate math for admin analytics. All boundaries are UTC;
 * ranges are half-open [from, to) except `to` for "now"-anchored presets.
 * Kept pure so metric definitions stay unit-testable.
 */

export type AnalyticsRangeKey = 'today' | '7d' | '30d' | '90d' | 'custom'

export const ANALYTICS_RANGE_KEYS: AnalyticsRangeKey[] = [
  'today',
  '7d',
  '30d',
  '90d',
  'custom',
]

export type AnalyticsRange = {
  key: AnalyticsRangeKey
  from: Date
  to: Date
}

function utcStartOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

function parseUtcDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed) ? null : new Date(parsed)
}

/**
 * Resolves a preset or custom range. Presets end at `now`; `today` starts at
 * UTC midnight and `7d/30d/90d` cover the trailing N*24h window. A custom
 * range covers [from 00:00Z, day-after-to 00:00Z); invalid custom input falls
 * back to 30d.
 */
export function resolveRange(
  key: string | null | undefined,
  from?: string | null,
  to?: string | null,
  now: Date = new Date(),
): AnalyticsRange {
  if (key === 'custom') {
    const fromDate = parseUtcDay(from)
    const toDate = parseUtcDay(to)
    if (fromDate && toDate && fromDate.getTime() <= toDate.getTime()) {
      return {
        key: 'custom',
        from: fromDate,
        to: new Date(toDate.getTime() + DAY_MS),
      }
    }
    return resolveRange('30d', null, null, now)
  }

  if (key === 'today') {
    return { key: 'today', from: utcStartOfDay(now), to: now }
  }

  const days = key === '7d' ? 7 : key === '90d' ? 90 : 30
  const resolvedKey: AnalyticsRangeKey =
    key === '7d' || key === '90d' ? key : '30d'
  return {
    key: resolvedKey,
    from: new Date(now.getTime() - days * DAY_MS),
    to: now,
  }
}

/** The equally long window immediately before the given range. */
export function previousPeriod(range: AnalyticsRange): { from: Date; to: Date } {
  const length = range.to.getTime() - range.from.getTime()
  return {
    from: new Date(range.from.getTime() - length),
    to: range.from,
  }
}

/**
 * Percentage change from previous to current. Null when the previous value is
 * zero or missing (no meaningful comparison), matching the UI's "—" state.
 */
export function pctChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Rate numerator/denominator as a percentage; null when the cohort is empty. */
export function conversionRate(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || !denominator) return null
  return (numerator / denominator) * 100
}
