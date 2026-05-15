'use client'

import * as React from 'react'
import { Sprout, Wallet, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { useDefindex } from '@/hooks/useDefindex'
import { useWallet } from '@/hooks/use-wallet'

export interface VaultToDealAllocatorProps {
  /** USDC amount needed to fund the deal */
  dealAmount: number
  /** Whether the deal is currently open for funding */
  isFundingOpen: boolean
  /** Disabled when e.g. user is not an investor or deal is already funded */
  disabled?: boolean
  /**
   * Called after a successful vault withdrawal.
   * The caller should use this to refresh wallet balance and then trigger the
   * normal escrow-funding flow.
   */
  onWithdrawComplete?: (withdrawnAmount: number) => void
  className?: string
}

type Step = 'idle' | 'withdrawing' | 'withdrawn' | 'error'

/**
 * VaultToDealAllocator shows the investor their vault balance alongside the
 * deal amount they need to fund, and lets them withdraw USDC from the DeFindex
 * vault directly into their wallet so it can then be used to fund the escrow.
 *
 * After a successful withdrawal the component notifies the parent via
 * `onWithdrawComplete` so it can refresh balances and enable the regular
 * "Fund Deal" button.
 */
export function VaultToDealAllocator({
  dealAmount,
  isFundingOpen,
  disabled,
  onWithdrawComplete,
  className,
}: VaultToDealAllocatorProps) {
  const { walletInfo, isConnected, canSignTransactions } = useWallet()
  const {
    walletBalance,
    vaultBalance,
    vaultMeta,
    isLoadingBalances,
    refreshBalances,
    withdrawFromVault,
  } = useDefindex()

  const [step, setStep] = React.useState<Step>('idle')
  const [error, setError] = React.useState<string | null>(null)

  const hasEnoughInWallet = walletBalance >= dealAmount
  const hasEnoughInVault = vaultBalance >= dealAmount
  const shortfall = Math.max(0, dealAmount - walletBalance)
  const canWithdraw =
    isConnected &&
    canSignTransactions &&
    hasEnoughInVault &&
    !disabled &&
    isFundingOpen

  const handleWithdraw = React.useCallback(async () => {
    if (!walletInfo?.address) {
      toast.error('Connect your wallet first')
      return
    }

    setStep('withdrawing')
    setError(null)

    try {
      // Withdraw the exact shortfall (or full deal amount if wallet is empty)
      const withdrawAmount = shortfall > 0 ? shortfall : dealAmount
      // DeFindex SDK expects amounts in stroops (7 decimals for USDC)
      const amountInStroops = Math.round(withdrawAmount * 1e7)

      await withdrawFromVault([amountInStroops])

      await refreshBalances()
      setStep('withdrawn')
      toast.success(`${formatCurrency(withdrawAmount)} USDC moved from vault to wallet`)
      onWithdrawComplete?.(withdrawAmount)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to withdraw from vault'
      setError(message)
      setStep('error')
      toast.error(message)
    }
  }, [
    walletInfo?.address,
    shortfall,
    dealAmount,
    withdrawFromVault,
    refreshBalances,
    onWithdrawComplete,
  ])

  if (!isConnected) return null

  // No vault configured or no balance — nothing useful to show
  if (!vaultMeta && vaultBalance === 0 && !isLoadingBalances) return null

  return (
    <Card className={cn('border-primary/20', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sprout className="h-4 w-4 text-emerald-500" aria-hidden />
          Use vault capital
        </CardTitle>
        <CardDescription className="text-xs">
          {vaultMeta
            ? `Capital in ${vaultMeta.name} (${vaultMeta.symbol}) — earning yield while you decide`
            : 'Move USDC from your DeFindex vault to fund this deal'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Balance overview */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md bg-muted/40 p-3">
            <div className="mb-0.5 flex items-center gap-1.5 text-muted-foreground">
              <Sprout className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
              In vault
            </div>
            <p className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {isLoadingBalances ? (
                <Skeleton className="h-5 w-16 inline-block" />
              ) : (
                formatCurrency(vaultBalance)
              )}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <div className="mb-0.5 flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 text-blue-500" aria-hidden />
              In wallet
            </div>
            <p className="text-base font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {isLoadingBalances ? (
                <Skeleton className="h-5 w-16 inline-block" />
              ) : (
                formatCurrency(walletBalance)
              )}
            </p>
          </div>
        </div>

        {/* Deal requirement */}
        <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Deal requires</span>
          <span className="font-semibold tabular-nums">{formatCurrency(dealAmount)} USDC</span>
        </div>

        {step === 'withdrawn' && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Funds moved to wallet. You can now fund the deal using the button above.
          </div>
        )}

        {step === 'error' && error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        {hasEnoughInWallet && step !== 'withdrawn' && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Wallet already has enough to fund this deal directly
          </p>
        )}

        {!hasEnoughInWallet && shortfall > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Withdraw <span className="font-semibold text-foreground">{formatCurrency(shortfall)}</span> from vault to cover shortfall
              </span>
            </div>

            <Button
              onClick={() => void handleWithdraw()}
              disabled={!canWithdraw || step === 'withdrawing'}
              size="sm"
              variant="outline"
              className="w-full gap-2"
            >
              {step === 'withdrawing' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Withdrawing…
                </>
              ) : (
                <>
                  <Sprout className="h-3.5 w-3.5" aria-hidden />
                  Move {formatCurrency(shortfall)} from vault
                </>
              )}
            </Button>

            {!canSignTransactions && isConnected && (
              <p className="text-[11px] text-muted-foreground">
                Your current wallet type cannot sign vault transactions. Connect a Freighter or Albedo wallet to use this feature.
              </p>
            )}
            {!hasEnoughInVault && (
              <p className="text-[11px] text-muted-foreground">
                Vault balance ({formatCurrency(vaultBalance)}) is less than required shortfall ({formatCurrency(shortfall)}).
              </p>
            )}
          </div>
        )}

        <Separator />

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Withdrawing moves USDC from the {vaultMeta?.name ?? 'Mercato'} vault into your connected wallet. Funds stop earning yield once withdrawn. The deal funding step is separate.
        </p>
      </CardContent>
    </Card>
  )
}
