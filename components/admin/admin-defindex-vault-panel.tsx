'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, Landmark } from 'lucide-react'
import { LAST_DEPLOY_STORAGE_KEY, VaultCreatePanel } from '@/components/admin/vault-create-panel'
import { VaultDepositPanel } from '@/components/admin/vault-deposit-panel'
import { VaultRebalancePanel } from '@/components/admin/vault-rebalance-panel'
import { useAdminVaultMonitor } from '@/hooks/use-admin-vault-monitor'

type Props = {
  configuredVaultAddress: string
}

export function AdminDefindexVaultPanel({ configuredVaultAddress }: Props) {
  const hasVaultEnv = Boolean(configuredVaultAddress.trim())
  const [sessionVaultAddress, setSessionVaultAddress] = useState<string | null>(null)

  useEffect(() => {
    if (configuredVaultAddress.trim()) return
    try {
      const raw = sessionStorage.getItem(LAST_DEPLOY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { vaultAddress?: string }
      if (parsed.vaultAddress?.trim()) setSessionVaultAddress(parsed.vaultAddress.trim())
    } catch {
      /* ignore */
    }
  }, [configuredVaultAddress])

  const activeVaultAddress = configuredVaultAddress.trim() || sessionVaultAddress || ''
  const monitorEnabled = Boolean(activeVaultAddress)

  const { data, refresh } = useAdminVaultMonitor({
    vaultOverride: activeVaultAddress || null,
    enabled: monitorEnabled,
    pollMs: monitorEnabled ? 30_000 : 0,
  })

  const handleDeployed = useCallback(
    (payload: { txHash: string | null; vaultAddress: string | null }) => {
      if (payload.vaultAddress) setSessionVaultAddress(payload.vaultAddress)
      if (payload.vaultAddress) void refresh()
    },
    [refresh],
  )

  const depositDone = (data?.totals.tvlDisplay ?? 0) > 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-violet-500" aria-hidden />
            Mercato DeFindex Vault
          </CardTitle>
          <CardDescription>
            The shared yield vault that MERCATO investors deposit into. Only one vault address
            is configured at a time via the <code className="text-xs">NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS</code> env var.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasVaultEnv ? (
            <div className="flex flex-wrap items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Vault configured</p>
                <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">{configuredVaultAddress}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">Active</Badge>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">No vault configured</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Deploy a vault below, then set{' '}
                  <code className="rounded bg-muted px-1">NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS</code> to the new{' '}
                  <code className="rounded bg-muted px-1">C…</code> contract address and redeploy.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <VaultCreatePanel onDeployed={handleDeployed} />

      {activeVaultAddress && data && (
        <>
          <VaultDepositPanel
            vaultAddress={activeVaultAddress}
            monitor={data}
            onSuccess={() => void refresh()}
          />
          <VaultRebalancePanel
            vaultAddress={activeVaultAddress}
            monitor={data}
            depositDone={depositDone}
            onSuccess={() => void refresh()}
          />
        </>
      )}
    </div>
  )
}
