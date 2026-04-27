import { ShieldCheck } from 'lucide-react'

import type { Reputation } from '@/lib/reputation'
import { formatCurrency, formatDecimal } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ReputationSummaryCardProps {
  reputation: Reputation | null
  className?: string
}

export function ReputationSummaryCard({
  reputation,
  className,
}: ReputationSummaryCardProps) {
  const hasStake = reputation?.stakeAmount != null

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          Reputation
        </CardTitle>
        <CardDescription>Score and committed stake for this account</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn('grid gap-4', hasStake ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Score
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-3xl font-semibold tabular-nums">
                {reputation?.score != null ? formatDecimal(reputation.score) : '-'}
              </p>
              {reputation?.trustLabel && (
                <Badge variant="secondary" className="capitalize">
                  {reputation.trustLabel.replaceAll('_', ' ')}
                </Badge>
              )}
            </div>
          </div>

          {hasStake && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Stake
              </p>
              <p className="text-3xl font-semibold tabular-nums">
                {formatCurrency(reputation.stakeAmount ?? 0)}{' '}
                <span className="text-sm font-medium text-muted-foreground">
                  {reputation.stakeCurrency}
                </span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
