import Link from 'next/link'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatInvestUsd } from '@/lib/investments/portfolio-metrics'
import type { InvestorPortfolio } from '@/lib/investments/types'

type PortfolioHeroProps = {
  portfolio: InvestorPortfolio
  labels: {
    hubLabel: string
    titlePossessive: string
    titleDefault: string
    subtitle: string
    portfolioValue: string
    totalReturn: string
    browseDeals: string
    activePositions: string
  }
}

export function PortfolioHero({ portfolio, labels }: PortfolioHeroProps) {
  const { metrics, displayName } = portfolio
  const title = displayName
    ? labels.titlePossessive.replace('{name}', displayName)
    : labels.titleDefault

  const portfolioValue = metrics.activeCapital + metrics.completedPrincipal
  const totalReturnDisplay =
    metrics.completedCount > 0
      ? `+${metrics.netReturnPercent.toFixed(1)}%`
      : metrics.weightedApr > 0
        ? `${metrics.weightedApr.toFixed(1)}% APR`
        : '—'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50/90 via-background to-teal-50/40 px-6 py-7 shadow-sm dark:from-emerald-950/30 dark:via-background dark:to-transparent md:px-8 md:py-9">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {labels.hubLabel}
          </p>
          <h1 className="font-display text-3xl font-normal leading-[1.05] tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-2 text-base text-muted-foreground">{labels.subtitle}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-800 dark:text-emerald-300"
            >
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              {labels.activePositions.replace('{count}', String(metrics.activeCount))}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 sm:flex-row sm:items-end">
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {labels.portfolioValue}
            </p>
            <p className="font-display text-4xl font-normal tabular-nums tracking-tight text-foreground md:text-5xl">
              {formatInvestUsd(portfolioValue)}
            </p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
              {labels.totalReturn.replace('{value}', totalReturnDisplay)}
            </p>
          </div>
          <Button asChild size="lg" className="rounded-full bg-emerald-600 px-6 hover:bg-emerald-700">
            <Link href="/deals">
              {labels.browseDeals}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
