'use client'

import { CheckCircle2, Circle, Sprout } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VaultDepositPanel } from '@/components/admin/vault-deposit-panel'
import { VaultRebalancePanel } from '@/components/admin/vault-rebalance-panel'
import { useAdminVaultTransactions } from '@/hooks/use-admin-vault-transactions'
import { useI18n } from '@/lib/i18n/provider'
import type { VaultMonitorPayload } from '@/lib/defindex/vault-monitor'

type AdminVaultActivationProps = {
  vaultAddress: string
  monitor: VaultMonitorPayload
  onSuccess: () => void
}

export function AdminVaultActivation({ vaultAddress, monitor, onSuccess }: AdminVaultActivationProps) {
  const { messages } = useI18n()
  const m = messages.adminVaultMonitor
  const { walletAddress, provider } = useAdminVaultTransactions()

  const depositDone = monitor.totals.tvlDisplay > 0
  const rebalanceDone =
    monitor.totals.investedDisplay > 0 && monitor.totals.idlePercent < 90

  if (rebalanceDone && depositDone) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 pt-6">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" aria-hidden />
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">{m.activationComplete}</p>
            <p className="text-sm text-muted-foreground">{m.activationCompleteHint}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-violet-500/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sprout className="h-5 w-5 text-violet-500" aria-hidden />
          {m.activationTitle}
        </CardTitle>
        <CardDescription>{m.activationSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!walletAddress && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            {m.connectWallet}
          </p>
        )}

        {walletAddress && provider !== 'pollar' && (
          <p className="text-xs text-muted-foreground">
            {m.signingAs.replace('{address}', `${walletAddress.slice(0, 8)}…${walletAddress.slice(-4)}`)}
          </p>
        )}

        <ol className="space-y-4">
          <li className="flex gap-3">
            <StepIcon done={depositDone} />
            <div className="min-w-0 flex-1">
              <VaultDepositPanel
                vaultAddress={vaultAddress}
                monitor={monitor}
                onSuccess={onSuccess}
                variant="embedded"
              />
            </div>
          </li>

          <li className="flex gap-3">
            <StepIcon done={rebalanceDone} />
            <div className="min-w-0 flex-1">
              <VaultRebalancePanel
                vaultAddress={vaultAddress}
                monitor={monitor}
                depositDone={depositDone}
                onSuccess={onSuccess}
                variant="embedded"
              />
            </div>
          </li>
        </ol>
      </CardContent>
    </Card>
  )
}

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
  ) : (
    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
  )
}
