import { Users } from 'lucide-react'
import { OwnershipStat } from '@/components/dashboard/vault-my-positions/ownership-stat'
import { VaultSectionHeader } from '@/components/dashboard/vault-ui'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactCurrency } from '@/lib/defindex/vault-display'
import { buildVaultPositionSummary } from '@/lib/defindex/vault-position'
import { formatDecimal } from '@/lib/format'

export type VaultOwnershipCardProps = {
  ownership: ReturnType<typeof buildVaultPositionSummary>
  supplySymbol: string
  isLoading: boolean
}

export function VaultOwnershipCard({
  ownership,
  supplySymbol,
  isLoading,
}: VaultOwnershipCardProps) {
  const tvl = ownership.vaultTvlDisplay
  const userPct = Math.min(100, Math.max(0, ownership.userSharePercent))
  const othersPct = Math.min(100, Math.max(0, ownership.othersSharePercent))

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <VaultSectionHeader
          title="Who owns the vault"
          description="Total vault value (TVL) includes your deposits and funds from other investors. Your share is what you can withdraw proportionally."
          icon={Users}
        />

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full rounded-full" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
        ) : tvl <= 0 && !ownership.hasPosition ? (
          <p className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
            No vault TVL data yet. Deposit to become the first liquidity provider.
          </p>
        ) : (
          <>
            <div
              className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`You own ${userPct.toFixed(1)} percent of the vault; other depositors own ${othersPct.toFixed(1)} percent.`}
            >
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${userPct}%` }}
              />
              <div
                className="h-full bg-slate-300 transition-all dark:bg-slate-600"
                style={{ width: `${othersPct}%` }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <OwnershipStat
                label="Your contribution"
                value={`$${formatDecimal(ownership.userPositionDisplay, { maxFractionDigits: 2 })}`}
                sublabel={`${userPct.toFixed(1)}% of vault · ${supplySymbol}`}
                accent="emerald"
              />
              <OwnershipStat
                label="Other depositors"
                value={`$${formatDecimal(ownership.othersDisplay, { maxFractionDigits: 2 })}`}
                sublabel={
                  ownership.isSoleDepositor
                    ? 'You are the only depositor so far'
                    : `${othersPct.toFixed(1)}% of vault · pooled from others`
                }
              />
              <OwnershipStat
                label="Total vault TVL"
                value={formatCompactCurrency(tvl)}
                sublabel="All assets managed by this vault"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
