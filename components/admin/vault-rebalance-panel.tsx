'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAdminVaultTransactions } from '@/hooks/use-admin-vault-transactions'
import { useI18n } from '@/lib/i18n/provider'
import type { VaultMonitorPayload } from '@/lib/defindex/vault-monitor'
import { formatCurrency } from '@/lib/format'
import { isMissingTrustlineError } from '@/lib/stellar/vault-asset-trustline'

type StrategyOption = {
  assetSymbol: string
  address: string
  name: string
  paused: boolean
}

type VaultRebalancePanelProps = {
  vaultAddress: string
  monitor: VaultMonitorPayload
  depositDone: boolean
  onSuccess?: () => void
  variant?: 'card' | 'embedded'
}

export function VaultRebalancePanel({
  vaultAddress,
  monitor,
  depositDone,
  onSuccess,
  variant = 'card',
}: VaultRebalancePanelProps) {
  const { messages } = useI18n()
  const m = messages.adminVaultMonitor
  const { walletAddress, submitAdminXdr } = useAdminVaultTransactions()

  const primaryAsset = monitor.assets[0]
  const rebalanceDone =
    monitor.totals.investedDisplay > 0 && monitor.totals.idlePercent < 90

  const strategyOptions = useMemo((): StrategyOption[] => {
    const out: StrategyOption[] = []
    for (const asset of monitor.assets) {
      for (const s of asset.strategies) {
        out.push({
          assetSymbol: asset.symbol,
          address: s.address,
          name: s.name,
          paused: s.paused,
        })
      }
    }
    return out
  }, [monitor.assets])

  const defaultStrategy =
    strategyOptions.find((s) => !s.paused)?.address ?? strategyOptions[0]?.address ?? ''

  const [strategyAddress, setStrategyAddress] = useState(defaultStrategy)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (defaultStrategy) setStrategyAddress(defaultStrategy)
  }, [defaultStrategy])

  const idleRaw = useMemo(() => {
    const raw = Number(primaryAsset?.idleRaw ?? 0)
    return Number.isFinite(raw) ? Math.floor(raw) : 0
  }, [primaryAsset?.idleRaw])

  const callerMatchesRebalance =
    walletAddress &&
    (walletAddress === monitor.roles.rebalanceManager ||
      walletAddress === monitor.roles.manager)

  const onRebalance = async () => {
    if (!strategyAddress) {
      toast.error(m.noStrategy)
      return
    }
    if (idleRaw <= 0) {
      toast.error(m.noIdle)
      return
    }
    if (walletAddress && !callerMatchesRebalance) {
      toast.error(m.callerRoleWarning)
    }

    setBusy(true)
    try {
      const result = await submitAdminXdr('/api/defindex/admin/rebalance', {
        vault: vaultAddress,
        instructions: [
          {
            type: 'Invest',
            strategy_address: strategyAddress,
            amount: idleRaw,
          },
        ],
      })
      if (result?.success === false) {
        toast.error(m.txFailed)
        return
      }
      toast.success(m.rebalanceSuccess)
      onSuccess?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : m.rebalanceFailed
      toast.error(isMissingTrustlineError(msg) ? m.trustMissingError : msg)
    } finally {
      setBusy(false)
    }
  }

  const content = (
    <div className="space-y-4">
      {variant === 'embedded' && (
        <div>
          <p className="font-medium">{m.stepRebalanceTitle}</p>
          <p className="text-sm text-muted-foreground">{m.stepRebalanceDesc}</p>
        </div>
      )}

      {variant === 'card' && !walletAddress && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          {m.connectWallet}
        </p>
      )}

      {variant === 'card' && walletAddress && (
        <p className="text-xs text-muted-foreground">
          {m.signingAs.replace('{address}', `${walletAddress.slice(0, 8)}…${walletAddress.slice(-4)}`)}
          {!callerMatchesRebalance && (
            <span className="mt-1 block text-amber-700 dark:text-amber-300">{m.callerRoleHint}</span>
          )}
        </p>
      )}

      {variant === 'embedded' && walletAddress && !callerMatchesRebalance && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{m.callerRoleHint}</p>
      )}

      {rebalanceDone ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{m.rebalanceDone}</p>
      ) : !depositDone ? (
        <p className="text-sm text-muted-foreground">{m.rebalanceAfterDeposit}</p>
      ) : (
        <div className="space-y-3">
          {strategyOptions.length > 1 ? (
            <div className="space-y-1.5">
              <Label>{m.strategyLabel}</Label>
              <Select value={strategyAddress} onValueChange={setStrategyAddress}>
                <SelectTrigger>
                  <SelectValue placeholder={m.strategyLabel} />
                </SelectTrigger>
                <SelectContent>
                  {strategyOptions.map((s) => (
                    <SelectItem key={s.address} value={s.address} disabled={s.paused}>
                      {s.assetSymbol} · {s.name}
                      {s.paused ? ` (${m.paused})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : strategyOptions[0] ? (
            <p className="text-xs text-muted-foreground">
              {m.strategyTarget.replace('{name}', strategyOptions[0].name)}
            </p>
          ) : null}
          <p className="text-sm">
            {m.idleToInvest.replace('{amount}', formatCurrency(primaryAsset?.idleDisplay ?? 0))}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={busy || !walletAddress || idleRaw <= 0}
            onClick={() => void onRebalance()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
            {m.rebalanceCta}
          </Button>
        </div>
      )}
    </div>
  )

  if (variant === 'embedded') return content

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{m.stepRebalanceTitle}</CardTitle>
        <CardDescription>{m.stepRebalanceDesc}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
