'use client'

import { useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, Sprout, Coins, RefreshCw, AlertCircle } from 'lucide-react'
import { useWallet } from '@/hooks/use-wallet'
import { useDefindex } from '@/hooks/useDefindex'
import { buildCapitalState, totalCapital } from '@/lib/capital'
import { formatDecimal } from '@/lib/format'

export function InvestorCapitalOverview() {
  const { isConnected, handleConnect } = useWallet()
  const { walletBalance, vaultBalance, isLoading, error, refresh } = useDefindex()

  const capitalState = useMemo(
    () =>
      buildCapitalState({
        wallet: walletBalance,
        inVault: vaultBalance,
        allocated: 0,
      }),
    [walletBalance, vaultBalance],
  )

  const total = useMemo(() => totalCapital(capitalState), [capitalState])

  const yieldShare = useMemo(() => {
    if (total <= 0) return 0
    return (capitalState.inVault / total) * 100
  }, [capitalState.inVault, total])

  if (!isConnected) {
    return (
      <Card className="mb-8 border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">Connect your wallet to view capital</p>
              <p className="text-sm text-muted-foreground">
                See balances across wallet, vault yield, and available capital in one place.
              </p>
            </div>
          </div>
          <Button onClick={handleConnect} size="sm">
            Connect wallet
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Capital overview</h2>
          <p className="text-xs text-muted-foreground">
            Total capital{' '}
            <span className="font-medium tabular-nums text-foreground">
              ${formatDecimal(total, { maxFractionDigits: 2 })}
            </span>
            {capitalState.inVault > 0 && (
              <>
                {' · '}
                <span className="tabular-nums">
                  {formatDecimal(yieldShare, { maxFractionDigits: 1 })}% earning yield
                </span>
              </>
            )}
          </p>
        </div>
        <Button
          onClick={() => void refresh()}
          variant="ghost"
          size="sm"
          disabled={isLoading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <BalanceCard
          icon={Wallet}
          label="Wallet"
          description="Liquid USDC in your wallet"
          value={capitalState.wallet}
          tone="blue"
          isLoading={isLoading}
        />
        <BalanceCard
          icon={Sprout}
          label="Vault (Yield)"
          description="Capital earning DeFindex yield"
          value={capitalState.inVault}
          tone="emerald"
          isLoading={isLoading}
        />
        <BalanceCard
          icon={Coins}
          label="Available"
          description="Ready to deploy into deals"
          value={capitalState.wallet}
          tone="amber"
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

interface BalanceCardProps {
  icon: React.ElementType
  label: string
  description: string
  value: number
  tone: 'blue' | 'emerald' | 'amber'
  isLoading: boolean
}

const TONES: Record<BalanceCardProps['tone'], { icon: string; bg: string }> = {
  blue: {
    icon: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
}

function BalanceCard({
  icon: Icon,
  label,
  description,
  value,
  tone,
  isLoading,
}: BalanceCardProps) {
  const palette = TONES[tone]
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${palette.bg}`}
          >
            <Icon className={`h-4 w-4 ${palette.icon}`} />
          </div>
        </div>
        <CardTitle className="text-3xl tabular-nums">
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <>
              <span className="text-base font-medium text-muted-foreground">$</span>
              {formatDecimal(value, { maxFractionDigits: 2 })}
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
