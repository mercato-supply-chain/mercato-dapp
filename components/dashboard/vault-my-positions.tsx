'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  PiggyBank,
  Sprout,
  Wallet,
} from 'lucide-react'
import { DashboardStatTile } from '@/components/dashboard/dashboard-stat-tile'
import { VaultActivitySection } from '@/components/dashboard/vault-my-positions/vault-activity-section'
import { VaultOwnershipCard } from '@/components/dashboard/vault-my-positions/vault-ownership-card'
import { DefindexPill, TokenAvatar } from '@/components/dashboard/vault-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createDedupedFetcher } from '@/lib/client/deduped-fetch'
import { buildVaultPositionSummary } from '@/lib/defindex/vault-position'
import { getPrimarySupplyAsset } from '@/lib/defindex/vault-display'
import { formatDecimal, formatPercent } from '@/lib/format'
import type { MercatoVaultMeta } from '@/hooks/useDefindex'
import type { VaultActivityEntry } from '@/lib/stellar/vault-activity'
import { summarizeVaultActivity } from '@/lib/stellar/vault-activity'

type VaultActivityApiResponse = {
  activity: VaultActivityEntry[]
  activitySummary: {
    depositCount: number
    withdrawCount: number
    totalDepositedDisplay: number
    totalWithdrawnDisplay: number
  }
}

export const vaultActivityRequest = createDedupedFetcher(
  async (address: string): Promise<VaultActivityApiResponse> => {
    const url = new URL('/api/stellar/vault-activity', window.location.origin)
    url.searchParams.set('account', address)
    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(data?.error ?? `Request failed (${response.status})`)
    }
    return (await response.json()) as VaultActivityApiResponse
  },
  (address) => `vault-activity:${address}`,
  15_000,
)

type VaultMyPositionsProps = {
  walletAddress: string
  walletBalance: number
  vaultBalance: number
  dfTokens: number
  vaultMeta: MercatoVaultMeta | null
  isLoadingBalances: boolean
  refreshNonce?: number
  historyRefreshNonce?: number
  onDeposit: () => void
  onWithdraw: () => void
}

export function VaultMyPositions({
  walletAddress,
  walletBalance,
  vaultBalance,
  dfTokens,
  vaultMeta,
  isLoadingBalances,
  refreshNonce = 0,
  historyRefreshNonce = 0,
  onDeposit,
  onWithdraw,
}: VaultMyPositionsProps) {
  const [activity, setActivity] = useState<VaultActivityEntry[]>([])
  const [activitySummary, setActivitySummary] = useState<VaultActivityApiResponse['activitySummary'] | null>(
    null,
  )
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)

  const supply = getPrimarySupplyAsset(vaultMeta)

  const ownership = useMemo(
    () =>
      buildVaultPositionSummary({
        userPositionDisplay: vaultBalance,
        vaultTvlDisplay: vaultMeta?.totals?.tvlDisplay ?? 0,
        dfTokensRaw: dfTokens,
        apy: vaultMeta?.apy,
        supplySymbol: supply.symbol,
      }),
    [vaultBalance, vaultMeta, dfTokens, supply.symbol],
  )

  const loadActivity = useCallback(async () => {
    if (!walletAddress) return
    setIsLoadingActivity(true)
    setActivityError(null)
    try {
      const data = await vaultActivityRequest.fetch(walletAddress)
      setActivity(data.activity)
      setActivitySummary(data.activitySummary)
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : 'Failed to load investment history.')
      setActivity([])
      setActivitySummary(null)
    } finally {
      setIsLoadingActivity(false)
    }
  }, [walletAddress])

  useEffect(() => {
    vaultActivityRequest.invalidate(walletAddress)
    void loadActivity()
  }, [loadActivity, historyRefreshNonce || refreshNonce, walletAddress])

  const vaultName = vaultMeta?.name ?? 'Mercato Vault'
  const isLoading = isLoadingBalances
  const isLoadingHistory = isLoadingActivity
  const resolvedActivitySummary =
    activitySummary ??
    (activity.length > 0 ? summarizeVaultActivity(activity) : null)

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-emerald-500/15 bg-gradient-to-br from-emerald-50/60 via-card to-card dark:from-emerald-950/25">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <TokenAvatar symbol={supply.symbol} size="lg" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Your vault position
                </p>
                <h2 className="line-clamp-2 font-display text-2xl font-normal tracking-tight sm:text-3xl">
                  {vaultName}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <DefindexPill />
                  {ownership.apy != null && ownership.apy > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {formatPercent(ownership.apy, { maxFractionDigits: 2 })} APY
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              {isLoading ? (
                <Skeleton className="ml-auto h-9 w-36" />
              ) : (
                <>
                  <p className="font-display text-3xl font-normal tabular-nums tracking-tight">
                    ${formatDecimal(ownership.userPositionDisplay, { maxFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground">Current value in vault</p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              onClick={onDeposit}
            >
              Deposit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={!ownership.hasPosition}
              onClick={onWithdraw}
            >
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatTile
          label="Wallet"
          value={
            isLoading ? '—' : `$${formatDecimal(walletBalance, { maxFractionDigits: 2 })}`
          }
          icon={Wallet}
          footer={`Liquid ${supply.symbol} ready to deposit`}
        />
        <DashboardStatTile
          label="Vault shares"
          value={
            isLoading ? '—' : formatDecimal(ownership.dfTokensDisplay, { maxFractionDigits: 4 })
          }
          icon={Sprout}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          footer="dfTokens representing your share"
        />
        <DashboardStatTile
          label="Est. yearly yield"
          value={
            isLoading
              ? '—'
              : ownership.estimatedYearlyYieldDisplay != null
                ? `$${formatDecimal(ownership.estimatedYearlyYieldDisplay, { maxFractionDigits: 2 })}`
                : '—'
          }
          icon={PiggyBank}
          footer="Based on current APY and balance"
        />
        <DashboardStatTile
          label="Deposits"
          value={
            isLoadingHistory
              ? '—'
              : String(resolvedActivitySummary?.depositCount ?? 0)
          }
          icon={ArrowDownToLine}
          footer={
            resolvedActivitySummary
              ? `$${formatDecimal(resolvedActivitySummary.totalDepositedDisplay, { maxFractionDigits: 2 })} total deposited`
              : 'On-chain deposit count'
          }
        />
      </div>

      <VaultOwnershipCard ownership={ownership} supplySymbol={supply.symbol} isLoading={isLoading} />

      <VaultActivitySection
        activity={activity}
        isLoading={isLoadingHistory}
        activityError={activityError}
        supplySymbol={supply.symbol}
        onRetry={() => {
          vaultActivityRequest.invalidate(walletAddress)
          void loadActivity()
        }}
      />
    </div>
  )
}
