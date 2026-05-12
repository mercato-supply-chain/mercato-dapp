'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wallet, RefreshCw, ExternalLink, Copy, AlertCircle, CircleCheckBig, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMercatoWallet } from '@/hooks/use-mercato-wallet'
import { useI18n } from '@/lib/i18n/provider'
import { PollarWalletKitLimitations } from '@/lib/mercato-wallet'

function formatBalance(value: string | null): string {
  if (!value) return '0'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function WalletStatusCard() {
  const { t } = useI18n()
  const {
    provider,
    publicKey,
    walletId,
    status,
    isConnected,
    isEmbedded,
    balances,
    txHistory,
    walletName,
    connectExternalWallet,
    connectPollarWallet,
    disconnect,
    refreshBalance,
  } = useMercatoWallet()
  const [activating, setActivating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshDone, setRefreshDone] = useState(false)

  const handleRefreshBalance = useCallback(async () => {
    setRefreshing(true)
    setRefreshDone(false)
    try {
      await refreshBalance()
      setRefreshDone(true)
      setTimeout(() => setRefreshDone(false), 2000)
    } finally {
      setRefreshing(false)
    }
  }, [refreshBalance])

  const copyAddress = async () => {
    if (!publicKey) return
    await navigator.clipboard.writeText(publicKey)
    toast.success(t('walletStatus.addressCopiedToast'))
  }

  const handleActivate = async () => {
    if (!walletId) {
      toast.error(t('walletStatus.activateUnavailable'))
      return
    }

    setActivating(true)
    try {
      const response = await fetch('/api/pollar/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId }),
      })
      const data = (await response.json()) as { error?: string; status?: string }
      if (!response.ok) throw new Error(data.error || t('walletStatus.activateFailed'))
      toast.success(data.status === 'active' ? t('walletStatus.walletActivated') : t('walletStatus.activateCompleted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('walletStatus.activateFailed'))
    } finally {
      setActivating(false)
    }
  }

  if (!isConnected || !publicKey) {
    return (
      <Card className="border-border/60 bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            {t('walletStatus.walletSetupTitle')}
          </CardTitle>
          <CardDescription>
            {t('walletStatus.walletSetupDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={connectExternalWallet} className="sm:flex-1">
            {t('wallet.connectStellarMenu')}
          </Button>
          <Button onClick={connectPollarWallet} variant="secondary" className="sm:flex-1">
            {t('wallet.continuePollarEmbedded')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/60 bg-gradient-to-br from-emerald-500/5 via-background to-background">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            {walletName || t('walletStatus.defaultWalletName')}
          </CardTitle>
          <Badge variant={status === 'active' ? 'secondary' : 'outline'} className="uppercase tracking-wide">
            {provider === 'pollar' || isEmbedded ? t('walletStatus.embedded') : t('walletStatus.external')}
          </Badge>
          {status && (
            <Badge variant={status === 'active' ? 'default' : 'outline'} className="uppercase tracking-wide">
              {status === 'pending' ? t('wallet.statusPending') : status === 'active' ? t('wallet.statusActive') : status}
            </Badge>
          )}
        </div>
        <CardDescription className="break-all font-mono text-xs">
          {publicKey}
        </CardDescription>
        {provider === 'pollar' && status !== 'active' && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {t('walletStatus.pendingActivationHint')} {PollarWalletKitLimitations}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-background/70 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">USDC</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {balances ? formatBalance(balances.usdc) : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/70 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">XLM</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {balances ? formatBalance(balances.xlm) : '—'}
            </p>
          </div>
        </div>

        {(() => {
          if (!txHistory || txHistory.step !== 'loaded') return null
          const history = txHistory as { data?: { records?: unknown[] } }
          const records = history.data?.records ?? []
          return (
            <div className="rounded-lg border border-border/60 bg-background/70 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('walletStatus.txHistory')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('walletStatus.txHistoryCount', { count: records.length })}
              </p>
            </div>
          )
        })()}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleRefreshBalance()}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : refreshDone ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t('walletStatus.refreshBalance')}
          </Button>
          <Button onClick={copyAddress} variant="outline" size="sm" className="gap-2">
            <Copy className="h-3.5 w-3.5" />
            {t('walletStatus.copyAddress')}
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <a
              href={`https://stellar.expert/explorer/${process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'public' : 'testnet'}/account/${publicKey}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('walletStatus.viewExplorer')}
            </a>
          </Button>
          <Button onClick={disconnect} variant="ghost" size="sm">
            {t('walletStatus.disconnect')}
          </Button>
        </div>

        {provider === 'pollar' && status !== 'active' && (
          <Button onClick={handleActivate} disabled={activating || !walletId} className="w-full gap-2">
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheckBig className="h-4 w-4" />}
            {t('walletStatus.activateEmbedded')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
