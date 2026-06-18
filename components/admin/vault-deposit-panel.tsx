'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VaultAssetTrustlineCard } from '@/components/admin/vault-asset-trustline-card'
import { useAdminVaultTransactions } from '@/hooks/use-admin-vault-transactions'
import { useI18n } from '@/lib/i18n/provider'
import { displayToRawTokenAmount, getPublicDefindexAssetDecimals } from '@/lib/defindex/client-amounts'
import {
  minInitDepositDisplay,
  VAULT_MIN_INIT_DEPOSIT_RAW,
} from '@/lib/defindex/vault-activation'
import type { VaultMonitorPayload } from '@/lib/defindex/vault-monitor'
import { formatCurrency, formatDecimal } from '@/lib/format'
import { isMissingTrustlineError } from '@/lib/stellar/vault-asset-trustline'

type VaultDepositPanelProps = {
  vaultAddress: string
  monitor: VaultMonitorPayload
  onSuccess?: () => void
  variant?: 'card' | 'embedded'
}

export function VaultDepositPanel({
  vaultAddress,
  monitor,
  onSuccess,
  variant = 'card',
}: VaultDepositPanelProps) {
  const { messages } = useI18n()
  const m = messages.adminVaultMonitor
  const { walletAddress, submitAdminXdr } = useAdminVaultTransactions()

  const decimals = getPublicDefindexAssetDecimals()
  const minDisplay = minInitDepositDisplay(decimals)
  const assetCount = Math.max(monitor.assets.length, 1)
  const primaryAsset = monitor.assets[0]
  const depositDone = monitor.totals.tvlDisplay > 0

  const [depositDisplay, setDepositDisplay] = useState(String(minDisplay))
  const [busy, setBusy] = useState(false)
  const [trustlineReady, setTrustlineReady] = useState(false)

  const buildAmountsArray = (rawFirstAsset: number): number[] => {
    const amounts = new Array(assetCount).fill(0) as number[]
    amounts[0] = rawFirstAsset
    return amounts
  }

  const onDeposit = async () => {
    const display = Number(depositDisplay)
    const raw = displayToRawTokenAmount(display, decimals)
    if (raw < VAULT_MIN_INIT_DEPOSIT_RAW) {
      toast.error(m.depositTooSmall.replace('{min}', formatDecimal(minDisplay, { maxFractionDigits: 7 })))
      return
    }

    setBusy(true)
    try {
      const result = await submitAdminXdr('/api/defindex/admin/deposit', {
        vault: vaultAddress,
        amounts: buildAmountsArray(raw),
        invest: false,
        slippageBps: 100,
      })
      if (result?.success === false) {
        toast.error(m.txFailed)
        return
      }
      toast.success(m.depositSuccess)
      onSuccess?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : m.depositFailed
      toast.error(isMissingTrustlineError(msg) ? m.trustMissingError : msg)
    } finally {
      setBusy(false)
    }
  }

  const content = (
    <div className="space-y-4">
      {variant === 'embedded' && (
        <div>
          <p className="font-medium">{m.stepDepositTitle}</p>
          <p className="text-sm text-muted-foreground">{m.stepDepositDesc}</p>
        </div>
      )}

      {variant === 'card' && !walletAddress && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          {m.connectWallet}
        </p>
      )}

      {depositDone ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {m.depositDone.replace('{tvl}', formatCurrency(monitor.totals.tvlDisplay))}
        </p>
      ) : (
        <>
          {primaryAsset && (
            <VaultAssetTrustlineCard
              assetContract={primaryAsset.address}
              assetSymbol={primaryAsset.symbol}
              assetName={primaryAsset.name}
              onTrustlineReady={() => setTrustlineReady(true)}
            />
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Label htmlFor="admin-vault-deposit">{m.depositAmountLabel}</Label>
              <Input
                id="admin-vault-deposit"
                type="number"
                min={minDisplay}
                step="any"
                value={depositDisplay}
                onChange={(e) => setDepositDisplay(e.target.value)}
                disabled={busy}
              />
              <p className="text-[11px] text-muted-foreground">
                {m.depositMinHint.replace('{min}', formatDecimal(minDisplay, { maxFractionDigits: 7 }))}
              </p>
            </div>
            <Button
              type="button"
              className="gap-2"
              disabled={busy || !walletAddress || !trustlineReady}
              onClick={() => void onDeposit()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Wallet className="h-4 w-4" aria-hidden />
              )}
              {m.depositCta}
            </Button>
          </div>
        </>
      )}
    </div>
  )

  if (variant === 'embedded') return content

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{m.stepDepositTitle}</CardTitle>
        <CardDescription>{m.stepDepositDesc}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
