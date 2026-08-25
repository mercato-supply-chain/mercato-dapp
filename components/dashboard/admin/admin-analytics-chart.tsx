'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { useI18n } from '@/lib/i18n/provider'

export type AnalyticsChartRow = {
  name: string
  current: number
  previous: number
}

type AdminAnalyticsChartProps = {
  rows: AnalyticsChartRow[]
  /** Accessible description of what the chart shows; the data table below carries the numbers. */
  ariaLabelKey: string
}

/** Current vs previous period comparison for one metric group. */
export function AdminAnalyticsChart({ rows, ariaLabelKey }: AdminAnalyticsChartProps) {
  const { t } = useI18n()

  const config = {
    current: {
      label: t('adminAnalytics.currentPeriod'),
      color: 'hsl(24 95% 53%)',
    },
    previous: {
      label: t('adminAnalytics.previousPeriod'),
      color: 'hsl(24 30% 70%)',
    },
  } satisfies ChartConfig

  if (rows.length === 0) return null

  return (
    <ChartContainer
      config={config}
      className="h-48 w-full"
      role="img"
      aria-label={t(ariaLabelKey)}
    >
      <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={40} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="previous" fill="var(--color-previous)" radius={4} />
        <Bar dataKey="current" fill="var(--color-current)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
