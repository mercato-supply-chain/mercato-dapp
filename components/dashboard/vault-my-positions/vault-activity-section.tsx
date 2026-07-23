import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, ExternalLink } from 'lucide-react'
import { VaultSectionHeader } from '@/components/dashboard/vault-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateLong } from '@/lib/date-utils'
import { formatDecimal } from '@/lib/format'
import type { VaultActivityEntry } from '@/lib/stellar/vault-activity'
import { cn } from '@/lib/utils'

export type VaultActivitySectionProps = {
  activity: VaultActivityEntry[]
  isLoading: boolean
  activityError: string | null
  supplySymbol: string
  onRetry: () => void
}

export function VaultActivitySection({
  activity,
  isLoading,
  activityError,
  supplySymbol,
  onRetry,
}: VaultActivitySectionProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <VaultSectionHeader
          title="Investment history"
          description="Each deposit and withdrawal to this vault, pulled from the Stellar ledger."
        />

        {activityError && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{activityError}</span>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : activity.length === 0 && !activityError ? (
          <p className="rounded-xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
            No vault deposits or withdrawals found for your wallet yet.
          </p>
        ) : activity.length === 0 ? null : (
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <ul className="divide-y divide-border">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          entry.kind === 'deposit'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                        )}
                      >
                        {entry.kind === 'deposit' ? (
                          <ArrowDownToLine className="h-4 w-4" aria-hidden />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium capitalize">{entry.kind}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateLong(entry.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">
                          {entry.kind === 'deposit' ? '+' : '−'}$
                          {formatDecimal(entry.amountDisplay, { maxFractionDigits: 2 })}{' '}
                          <span className="text-xs font-normal text-muted-foreground">{supplySymbol}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.transactionHash.slice(0, 8)}…
                        </p>
                      </div>
                      <Link
                        href={entry.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="View transaction on Stellar Expert"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isLoading && activity.length > 0 && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            Amounts reflect on-chain {supplySymbol} units at transaction time.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
