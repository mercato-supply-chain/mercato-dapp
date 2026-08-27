import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AdminAnalyticsChart,
  type AnalyticsChartRow,
} from '@/components/dashboard/admin/admin-analytics-chart'
import { pctChange } from '@/lib/admin/analytics-definitions'
import type { MetricPair } from '@/lib/admin/get-admin-analytics'
import type { Locale } from '@/lib/i18n/config'
import type { Messages } from '@/lib/i18n/dictionaries'
import { formatMoneyServer, tr } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

export type MetricFormat = 'count' | 'money' | 'percent' | 'duration'

export type MetricDisplay = {
  labelKey: string
  pair: MetricPair
  format: MetricFormat
}

export type SnapshotDisplay = {
  labelKey: string
  value: number
  format?: MetricFormat
}

function formatValue(
  value: number | null,
  format: MetricFormat,
  locale: Locale,
  m: Messages,
): string {
  if (value == null) return '—'
  switch (format) {
    case 'money':
      return formatMoneyServer(locale, value)
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'duration': {
      const hours = value / 3600
      if (hours < 1) return tr(m, 'adminAnalytics.durationMinutes', { count: Math.round(value / 60) })
      if (hours < 48) return tr(m, 'adminAnalytics.durationHours', { count: Math.round(hours) })
      return tr(m, 'adminAnalytics.durationDays', { count: Math.round(hours / 24) })
    }
    default:
      return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US').format(value)
  }
}

function DeltaBadge({ pair, m }: { pair: MetricPair; m: Messages }) {
  const delta = pctChange(pair.current, pair.previous)
  if (delta == null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden />
        {tr(m, 'adminAnalytics.noComparison')}
      </span>
    )
  }
  const up = delta > 0
  const flat = delta === 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        flat
          ? 'text-muted-foreground'
          : up
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-red-700 dark:text-red-400',
      )}
    >
      {flat ? (
        <Minus className="h-3 w-3" aria-hidden />
      ) : up ? (
        <ArrowUpRight className="h-3 w-3" aria-hidden />
      ) : (
        <ArrowDownRight className="h-3 w-3" aria-hidden />
      )}
      {`${up ? '+' : ''}${delta.toFixed(1)}%`}
    </span>
  )
}

type AdminAnalyticsSectionProps = {
  titleKey: string
  descriptionKey: string
  metrics: MetricDisplay[]
  snapshot: SnapshotDisplay[]
  snapshotTitleKey: string
  chartRows: AnalyticsChartRow[]
  chartAriaLabelKey: string
  messages: Messages
  locale: Locale
}

/**
 * One analytics group: period metrics with deltas, a comparison chart, and an
 * accessible table carrying the same numbers.
 */
export function AdminAnalyticsSection({
  titleKey,
  descriptionKey,
  metrics,
  snapshot,
  snapshotTitleKey,
  chartRows,
  chartAriaLabelKey,
  messages: m,
  locale,
}: AdminAnalyticsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tr(m, titleKey)}</CardTitle>
        <CardDescription>{tr(m, descriptionKey)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.labelKey}
              className="rounded-xl border border-border/70 bg-card p-3"
            >
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {tr(m, metric.labelKey)}
              </p>
              <p className="mt-1 truncate font-display text-xl tabular-nums">
                {formatValue(metric.pair.current, metric.format, locale, m)}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <DeltaBadge pair={metric.pair} m={m} />
              </p>
            </div>
          ))}
        </div>

        <AdminAnalyticsChart rows={chartRows} ariaLabelKey={chartAriaLabelKey} />

        <details>
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            {tr(m, 'adminAnalytics.showTable')}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr(m, 'adminAnalytics.tableMetric')}</TableHead>
                  <TableHead className="text-right">
                    {tr(m, 'adminAnalytics.currentPeriod')}
                  </TableHead>
                  <TableHead className="text-right">
                    {tr(m, 'adminAnalytics.previousPeriod')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((metric) => (
                  <TableRow key={metric.labelKey}>
                    <TableCell>{tr(m, metric.labelKey)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatValue(metric.pair.current, metric.format, locale, m)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatValue(metric.pair.previous, metric.format, locale, m)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {tr(m, snapshotTitleKey)}
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
            {snapshot.map((row) => (
              <div key={row.labelKey} className="flex items-baseline justify-between gap-2">
                <dt className="truncate text-xs text-muted-foreground">
                  {tr(m, row.labelKey)}
                </dt>
                <dd className="text-sm font-medium tabular-nums">
                  {formatValue(row.value, row.format ?? 'count', locale, m)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  )
}
