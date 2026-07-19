'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Loader2 } from 'lucide-react'
import { StellarMark, TokenAvatar } from '@/components/dashboard/vault-ui'
import { formatDecimal, formatPercent } from '@/lib/format'
import { getPrimarySupplyAsset } from '@/lib/defindex/vault-display'
import { displayToRawAmount } from '@/lib/defindex/amounts'
import { getDefindexAssetDecimals, hasClientVaultConfigured } from '@/lib/defindex/client-config'
import { VaultAssetTrustlineCard } from '@/components/admin/vault-asset-trustline-card'
import type { MercatoVaultMeta } from '@/hooks/useDefindex'
import type { SendTransactionResponse } from '@defindex/sdk'

type Props = {
  vaultMeta: MercatoVaultMeta | null
  walletBalance: number
  walletRawBalance?: number
  vaultBalance: number
  vaultRawBalance?: number
  canSignTransactions: boolean
  walletAddress: string | undefined
  isLoadingBalances: boolean
  depositToVault: (...args: unknown[]) => Promise<unknown>
  withdrawFromVault: (...args: unknown[]) => Promise<unknown>
  onRefreshBalances?: () => Promise<unknown>
  initialTab?: 'deposit' | 'withdraw'
  variant?: 'panel' | 'card'
}

function parsePositiveAmount(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function projectedEarnings(amount: number, apy: number) {
  const yearly = amount * (apy / 100)
  return {
    monthly: yearly / 12,
    yearly,
  }
}

export function MercatoVaultActions({
  vaultMeta,
  walletBalance,
  walletRawBalance = 0,
  vaultBalance,
  vaultRawBalance = 0,
  canSignTransactions,
  walletAddress,
  isLoadingBalances,
  depositToVault,
  withdrawFromVault,
  onRefreshBalances,
  initialTab = 'deposit',
  variant = 'card',
}: Props) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab)
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | null>(null)

  const handleTrustlineReady = useCallback(() => {
    void onRefreshBalances?.()
  }, [onRefreshBalances])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const vaultConfigured = hasClientVaultConfigured()

  const assetCount = vaultMeta?.assets?.length ?? 0
  const singleAssetVault = assetCount <= 1
  const supply = getPrimarySupplyAsset(vaultMeta)
  const apy = vaultMeta?.apy ?? 0
  const vaultAssetContract = vaultMeta?.assets?.[0]?.address
  const showVaultAssetSetup =
    Boolean(vaultAssetContract) && walletRawBalance <= 0 && !isLoadingBalances

  const depositAmount = useMemo(() => parsePositiveAmount(depositInput) ?? 0, [depositInput])
  const depositProjections = useMemo(
    () => projectedEarnings(depositAmount, apy),
    [depositAmount, apy],
  )

  const onDeposit = useCallback(async () => {
    const usd = parsePositiveAmount(depositInput)
    if (!usd) {
      toast.error('Enter a valid deposit amount.')
      return
    }
    const raw = displayToRawAmount(usd)
    if (raw <= 0) {
      toast.error('Enter a valid deposit amount.')
      return
    }

    const maxRaw =
      walletRawBalance > 0 ? walletRawBalance : displayToRawAmount(walletBalance)
    if (maxRaw <= 0) {
      toast.error(
        `No ${supply.symbol} available to deposit. Add a SAC trustline for the vault asset and fund your wallet with ${supply.symbol}.`,
      )
      return
    }
    if (raw > maxRaw) {
      toast.error(`Amount exceeds your available ${supply.symbol} balance (${formatDecimal(walletBalance, { maxFractionDigits: 6 })}).`)
      return
    }

    const amounts = [Math.min(raw, maxRaw)]

    setBusy('deposit')
    try {
      const result = (await depositToVault(amounts)) as SendTransactionResponse
      if (result?.success === false) {
        toast.error('Deposit transaction was not successful.')
        return
      }
      toast.success('Deposited to Mercato vault.', {
        description: result?.txHash ? `Hash: ${result.txHash}` : undefined,
      })
      setDepositInput('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deposit failed.')
    } finally {
      setBusy(null)
    }
  }, [depositInput, depositToVault, supply.symbol, walletBalance, walletRawBalance])

  const onWithdraw = useCallback(async () => {
    const usd = parsePositiveAmount(withdrawInput)
    if (!usd) {
      toast.error('Enter a valid withdrawal amount.')
      return
    }
    const raw = displayToRawAmount(usd)
    const maxRaw =
      vaultRawBalance > 0
        ? vaultRawBalance
        : displayToRawAmount(vaultBalance)
    const amounts = [Math.min(raw, maxRaw)]
    if (amounts[0] <= 0) {
      toast.error('Amount is too small or exceeds vault balance.')
      return
    }

    setBusy('withdraw')
    try {
      const result = (await withdrawFromVault(amounts)) as SendTransactionResponse
      if (result?.success === false) {
        toast.error('Withdrawal transaction was not successful.')
        return
      }
      toast.success('Withdrew from Mercato vault.', {
        description: result?.txHash ? `Hash: ${result.txHash}` : undefined,
      })
      setWithdrawInput('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Withdrawal failed.')
    } finally {
      setBusy(null)
    }
  }, [withdrawFromVault, withdrawInput, vaultBalance, vaultRawBalance])

  if (!vaultConfigured) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Vault integration is not configured. Set{' '}
          <code className="text-xs">NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS</code> after the admin
          deploys the vault.
        </CardContent>
      </Card>
    )
  }

  const shellClass =
    variant === 'panel'
      ? 'w-full min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-elevated'
      : 'w-full min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card'

  return (
    <div className={shellClass}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'deposit' | 'withdraw')}
        className="w-full"
      >
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-none border-b border-border/60 bg-muted/30 p-1.5">
          <TabsTrigger
            value="deposit"
            className="rounded-lg text-sm font-medium data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Deposit
          </TabsTrigger>
          <TabsTrigger
            value="withdraw"
            className="rounded-lg text-sm font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
          >
            Withdraw
          </TabsTrigger>
        </TabsList>

        <div className="p-4 sm:p-5">
          {!canSignTransactions && walletAddress && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Embedded Pollar wallets cannot sign Soroban vault transactions yet. Connect Freighter
                or Albedo to deposit or withdraw.
              </span>
            </div>
          )}

          {!singleAssetVault && vaultMeta && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This vault has multiple assets ({assetCount}). These actions only support
                single-asset vaults.
              </span>
            </div>
          )}

          <TabsContent value="deposit" className="mt-0 space-y-4">
            {showVaultAssetSetup && vaultAssetContract && (
              <VaultAssetTrustlineCard
                assetContract={vaultAssetContract}
                assetSymbol={supply.symbol}
                assetName={supply.name}
                onTrustlineReady={handleTrustlineReady}
              />
            )}

            <div className="space-y-2.5">
              <Label htmlFor="vault-deposit" className="flex items-center gap-2 text-sm font-medium">
                <TokenAvatar symbol={supply.symbol} size="sm" />
                <span className="truncate">Deposit {supply.symbol}</span>
              </Label>
              <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/30 to-muted/10 p-3 sm:p-4">
                <Input
                  id="vault-deposit"
                  inputMode="decimal"
                  placeholder="0"
                  value={depositInput}
                  disabled={!canSignTransactions || !singleAssetVault || busy !== null}
                  onChange={(e) => setDepositInput(e.target.value)}
                  className="h-auto min-w-0 border-0 bg-transparent px-0 text-2xl font-semibold tabular-nums shadow-none focus-visible:ring-0 sm:text-3xl"
                />
                <p className="text-sm text-muted-foreground">
                  ${formatDecimal(depositAmount, { maxFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  Available: {formatDecimal(walletBalance, { maxFractionDigits: 6 })} {supply.symbol}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  disabled={!canSignTransactions || !singleAssetVault || busy !== null}
                  onClick={() =>
                    setDepositInput(formatDecimal(Math.max(0, walletBalance), { maxFractionDigits: 6 }))
                  }
                >
                  MAX
                </Button>
              </div>
            </div>

            <dl className="space-y-2 rounded-xl bg-muted/20 px-3 py-2.5 text-xs sm:px-4 sm:py-3 sm:text-sm">
              <Row label="Network" value={<StellarMark className="shrink-0" />} />
              <Row
                label={`Deposit (${supply.symbol})`}
                value={formatDecimal(depositAmount, { maxFractionDigits: 2 })}
              />
              <Row
                label="APY"
                value={
                  Number.isFinite(apy) && apy > 0
                    ? formatPercent(apy, { maxFractionDigits: 2 })
                    : '—'
                }
              />
              <Row
                label="Est. monthly"
                value={`$${formatDecimal(depositProjections.monthly, { maxFractionDigits: 2 })}`}
              />
              <Row
                label="Est. yearly"
                value={`$${formatDecimal(depositProjections.yearly, { maxFractionDigits: 2 })}`}
              />
            </dl>

            <Button
              className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:h-12 sm:text-base dark:bg-emerald-600 dark:hover:bg-emerald-500"
              disabled={!canSignTransactions || !singleAssetVault || busy !== null}
              onClick={() => void onDeposit()}
            >
              {busy === 'deposit' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                `Deposit ${supply.symbol}`
              )}
            </Button>
          </TabsContent>

          <TabsContent value="withdraw" className="mt-0 space-y-4">
            <div className="space-y-2.5">
              <Label htmlFor="vault-withdraw" className="flex items-center gap-2 text-sm font-medium">
                <TokenAvatar symbol={supply.symbol} size="sm" />
                <span className="truncate">Withdraw {supply.symbol}</span>
              </Label>
              <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/30 to-muted/10 p-3 sm:p-4">
                <Input
                  id="vault-withdraw"
                  inputMode="decimal"
                  placeholder="0"
                  value={withdrawInput}
                  disabled={!canSignTransactions || !singleAssetVault || busy !== null}
                  onChange={(e) => setWithdrawInput(e.target.value)}
                  className="h-auto min-w-0 border-0 bg-transparent px-0 text-2xl font-semibold tabular-nums shadow-none focus-visible:ring-0 sm:text-3xl"
                />
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  In vault: {formatDecimal(vaultBalance, { maxFractionDigits: 2 })} {supply.symbol}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  disabled={!canSignTransactions || !singleAssetVault || busy !== null}
                  onClick={() =>
                    setWithdrawInput(formatDecimal(Math.max(0, vaultBalance), { maxFractionDigits: 6 }))
                  }
                >
                  MAX
                </Button>
              </div>
            </div>

            <dl className="space-y-2 rounded-xl bg-muted/20 px-3 py-2.5 text-xs sm:px-4 sm:py-3 sm:text-sm">
              <Row label="Network" value={<StellarMark className="shrink-0" />} />
              <Row
                label={`Withdraw (${supply.symbol})`}
                value={formatDecimal(parsePositiveAmount(withdrawInput) ?? 0, { maxFractionDigits: 2 })}
              />
            </dl>

            <Button
              variant="outline"
              className="h-11 w-full rounded-xl border-foreground/20 text-sm font-semibold hover:bg-muted/50 sm:h-12 sm:text-base"
              disabled={!canSignTransactions || !singleAssetVault || busy !== null}
              onClick={() => void onWithdraw()}
            >
              {busy === 'withdraw' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                `Withdraw ${supply.symbol}`
              )}
            </Button>
          </TabsContent>
        </div>
      </Tabs>

      {variant === 'card' && (
        <p className="border-t border-border/60 px-5 pb-4 text-[11px] text-muted-foreground">
          Raw amounts use {getDefindexAssetDecimals()} decimals.
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5">
      <dt className="min-w-0 truncate text-muted-foreground">{label}</dt>
      <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
}
