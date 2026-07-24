'use client'

import { useCallback, useState } from 'react'
import { VaultHero } from '@/components/dashboard/vault-hero'
import { VaultListingCard } from '@/components/dashboard/vault-listing-card'
import { VaultDetailView } from '@/components/dashboard/vault-detail-view'
import { VaultMyPositions } from '@/components/dashboard/vault-my-positions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWallet } from '@/hooks/use-wallet'
import { useDefindex } from '@/hooks/useDefindex'
import { getPrimarySupplyAsset } from '@/lib/defindex/vault-display'
import { AlertCircle, RefreshCw, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

type ViewerRole = 'investor' | 'pyme'

type VaultDashboardProps = {
  viewerRole?: ViewerRole
}

export function VaultDashboard({ viewerRole = 'investor' }: VaultDashboardProps) {
  const [pageTab, setPageTab] = useState<'vaults' | 'positions'>('vaults')
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [actionTab, setActionTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [historyRefreshNonce, setHistoryRefreshNonce] = useState(0)

  const { isConnected, handleConnect, canSignTransactions, publicKey, walletInfo } = useWallet()
  const {
    walletBalance,
    walletRawBalance,
    vaultBalance,
    vaultRawBalance,
    dfTokens,
    isLoadingBalances,
    balanceError,
    vaultInfoError,
    vaultMeta,
    refreshBalances,
    depositToVault,
    withdrawFromVault,
  } = useDefindex()

  const handleDepositToVault = useCallback(async (...args: Parameters<typeof depositToVault>) => {
    const res = await depositToVault(...args) as any
    if (res && res.success !== false) {
      setHistoryRefreshNonce((n) => n + 1)
    }
    return res
  }, [depositToVault])

  const handleWithdrawFromVault = useCallback(async (...args: Parameters<typeof withdrawFromVault>) => {
    const res = await withdrawFromVault(...args) as any
    if (res && res.success !== false) {
      setHistoryRefreshNonce((n) => n + 1)
    }
    return res
  }, [withdrawFromVault])

  const isLoadingVault = vaultMeta == null && !vaultInfoError
  const supply = getPrimarySupplyAsset(vaultMeta)

  const openDetail = (tab: 'deposit' | 'withdraw' = 'deposit') => {
    setActionTab(tab)
    setView('detail')
    setPageTab('vaults')
  }

  return (
    <div className="space-y-8">
      {view === 'list' && (
        <VaultHero
          tvl={vaultMeta?.totals?.tvlDisplay}
          apy={vaultMeta?.apy}
          supplySymbol={supply.symbol}
          isLoading={isLoadingVault}
        />
      )}

      <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as 'vaults' | 'positions')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-11 rounded-full border border-border/60 bg-card p-1 shadow-sm">
            <TabsTrigger
              value="vaults"
              className="rounded-full px-5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              Vaults
            </TabsTrigger>
            <TabsTrigger
              value="positions"
              className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              My Positions
            </TabsTrigger>
          </TabsList>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingBalances}
            onClick={() => {
              void refreshBalances()
            }}
            className="gap-1.5 rounded-full"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoadingBalances && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <TabsContent value="vaults" className="mt-8">
          {view === 'list' ? (
            <VaultListingCard
              vaultMeta={vaultMeta}
              isLoading={isLoadingVault}
              onOpen={() => openDetail('deposit')}
              onDeposit={() => openDetail('deposit')}
            />
          ) : (
            <VaultDetailView
              vaultMeta={vaultMeta}
              isLoadingVault={isLoadingVault}
              vaultInfoError={vaultInfoError}
              walletBalance={walletBalance}
              walletRawBalance={walletRawBalance}
              vaultBalance={vaultBalance}
              vaultRawBalance={vaultRawBalance}
              canSignTransactions={canSignTransactions}
              walletAddress={walletInfo?.address ?? publicKey ?? undefined}
              isLoadingBalances={isLoadingBalances}
              depositToVault={handleDepositToVault}
              withdrawFromVault={handleWithdrawFromVault}
              onRefreshBalances={refreshBalances}
              onBack={() => setView('list')}
              initialTab={actionTab}
            />
          )}
        </TabsContent>

        <TabsContent value="positions" className="mt-8 space-y-6">
          {!isConnected ? (
            <Card className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium">Connect your wallet to view positions</p>
                    <p className="text-sm text-muted-foreground">
                      {viewerRole === 'pyme'
                        ? 'See wallet balance, vault yield, and funds ready for deals.'
                        : 'Track your vault share, ownership vs other depositors, and deposit history.'}
                    </p>
                  </div>
                </div>
                <Button onClick={handleConnect} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                  Connect wallet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {(balanceError || vaultInfoError) && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{balanceError ?? vaultInfoError}</span>
                </div>
              )}

              <VaultMyPositions
                walletAddress={walletInfo?.address ?? publicKey ?? ''}
                walletBalance={walletBalance}
                vaultBalance={vaultBalance}
                dfTokens={dfTokens}
                vaultMeta={vaultMeta}
                isLoadingBalances={isLoadingBalances}
                historyRefreshNonce={historyRefreshNonce}
                onDeposit={() => {
                  setPageTab('vaults')
                  openDetail('deposit')
                }}
                onWithdraw={() => {
                  setPageTab('vaults')
                  openDetail('withdraw')
                }}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
