'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, Loader2 } from 'lucide-react'
import { formatDecimal } from '@/lib/format'
import {
  displayToRawTokenAmount,
  getPublicDefindexAssetDecimals,
} from '@/lib/defindex/client-amounts'
import type { MercatoVaultMeta } from '@/hooks/useDefindex'
import type { SendTransactionResponse } from '@defindex/sdk'

type Props = {
  vaultMeta: MercatoVaultMeta | null
  walletBalance: number
  vaultBalance: number
  canSignTransactions: boolean
  walletAddress: string | undefined
  isLoadingBalances: boolean
  depositToVault: (...args: unknown[]) => Promise<unknown>
  withdrawFromVault: (...args: unknown[]) => Promise<unknown>
}

function parsePositiveAmount(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function MercatoVaultActions({
  vaultMeta,
  walletBalance,
  vaultBalance,
  canSignTransactions,
  walletAddress,
  isLoadingBalances,
  depositToVault,
  withdrawFromVault,
}: Props) {
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | null>(null)

  const vaultConfigured =
    typeof process !== 'undefined' &&
    Boolean(
      process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim() ||
        process.env.NEXT_PUBLIC_MERCATO_DEFINDEX_VAULT_ADDRESS?.trim()
    )

  const assetCount = vaultMeta?.assets?.length ?? 0
  const singleAssetVault = assetCount <= 1

  const onDeposit = useCallback(async () => {
    const usd = parsePositiveAmount(depositInput)
    if (!usd) {
      toast.error('Enter a valid deposit amount.')
      return
    }
    const raw = displayToRawTokenAmount(usd)
    const maxRaw = displayToRawTokenAmount(walletBalance)
    const amounts = [Math.min(raw, maxRaw)]
    if (amounts[0] <= 0) {
      toast.error('Amount is too small or exceeds wallet balance.')
      return
    }

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
  }, [depositInput, depositToVault, walletBalance])

  const onWithdraw = useCallback(async () => {
    const usd = parsePositiveAmount(withdrawInput)
    if (!usd) {
      toast.error('Enter a valid withdrawal amount.')
      return
    }
    const raw = displayToRawTokenAmount(usd)
    const maxRaw = displayToRawTokenAmount(vaultBalance)
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
  }, [withdrawFromVault, withdrawInput, vaultBalance])

  if (!vaultConfigured) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mercato yield vault</CardTitle>
          <CardDescription>
            Vault integration is not configured. Set{' '}
            <code className="text-xs">NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS</code> after the admin deploys the vault.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Mercato yield vault</CardTitle>
        <CardDescription>
          Deposit USDC into the shared vault to earn yield, or withdraw to your wallet. Raw amounts use{' '}
          {getPublicDefindexAssetDecimals()} decimals (
          <code className="text-xs">NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS</code>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canSignTransactions && walletAddress && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Embedded Pollar wallets cannot sign Soroban vault transactions yet. Connect Freighter or Albedo via
              Stellar Wallets Kit to deposit or withdraw.
            </span>
          </div>
        )}

        {!singleAssetVault && vaultMeta && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This vault has multiple assets ({assetCount}). These quick actions only support single-asset vaults.
            </span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vault-deposit">Deposit (USDC)</Label>
            <div className="flex gap-2">
              <Input
                id="vault-deposit"
                inputMode="decimal"
                placeholder="0.00"
                value={depositInput}
                disabled={!canSignTransactions || !singleAssetVault || busy !== null}
                onChange={(e) => setDepositInput(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!canSignTransactions || !singleAssetVault || busy !== null}
                onClick={() =>
                  setDepositInput(formatDecimal(Math.max(0, walletBalance), { maxFractionDigits: 6 }))
                }
              >
                Max
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Wallet: ${formatDecimal(walletBalance, { maxFractionDigits: 2 })}
            </p>
            <Button
              className="w-full gap-2 sm:w-auto"
              disabled={
                !canSignTransactions || !singleAssetVault || busy !== null || isLoadingBalances
              }
              onClick={() => void onDeposit()}
            >
              {busy === 'deposit' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ArrowDownToLine className="h-4 w-4" aria-hidden />
              )}
              Deposit
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vault-withdraw">Withdraw (USDC)</Label>
            <div className="flex gap-2">
              <Input
                id="vault-withdraw"
                inputMode="decimal"
                placeholder="0.00"
                value={withdrawInput}
                disabled={!canSignTransactions || !singleAssetVault || busy !== null}
                onChange={(e) => setWithdrawInput(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!canSignTransactions || !singleAssetVault || busy !== null}
                onClick={() =>
                  setWithdrawInput(formatDecimal(Math.max(0, vaultBalance), { maxFractionDigits: 6 }))
                }
              >
                Max
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              In vault: ${formatDecimal(vaultBalance, { maxFractionDigits: 2 })}
            </p>
            <Button
              variant="secondary"
              className="w-full gap-2 sm:w-auto"
              disabled={
                !canSignTransactions || !singleAssetVault || busy !== null || isLoadingBalances
              }
              onClick={() => void onWithdraw()}
            >
              {busy === 'withdraw' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" aria-hidden />
              )}
              Withdraw
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
