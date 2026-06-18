'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Landmark,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react'
import { AdminVaultActivation } from '@/components/admin/admin-vault-activation'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminVaultMonitor } from '@/hooks/use-admin-vault-monitor'
import { useI18n } from '@/lib/i18n/provider'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { VaultMonitorAlertSeverity } from '@/lib/defindex/vault-monitor'
import { cn } from '@/lib/utils'

import { LAST_DEPLOY_STORAGE_KEY } from '@/components/admin/vault-create-panel'

type AdminVaultMonitorProps = {
  configuredVaultAddress: string
}

function alertStyles(severity: VaultMonitorAlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'border-red-500/40 bg-red-500/5 text-red-900 dark:text-red-200'
    case 'warning':
      return 'border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200'
    default:
      return 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200'
  }
}

function alertIcon(severity: VaultMonitorAlertSeverity) {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-4 w-4 shrink-0" aria-hidden />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
    default:
      return <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
  }
}

export function AdminVaultMonitor({ configuredVaultAddress }: AdminVaultMonitorProps) {
  const { messages } = useI18n()
  const m = messages.adminVaultMonitor
  const [watchAddress, setWatchAddress] = useState(configuredVaultAddress)
  const [appliedWatch, setAppliedWatch] = useState(configuredVaultAddress)

  useEffect(() => {
    if (configuredVaultAddress.trim()) {
      setWatchAddress(configuredVaultAddress)
      setAppliedWatch(configuredVaultAddress)
      return
    }
    try {
      const raw = sessionStorage.getItem(LAST_DEPLOY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { vaultAddress?: string }
      if (parsed.vaultAddress?.trim()) {
        setWatchAddress(parsed.vaultAddress)
        setAppliedWatch(parsed.vaultAddress)
      }
    } catch {
      /* ignore */
    }
  }, [configuredVaultAddress])

  const hasEnvVault = Boolean(configuredVaultAddress.trim())
  const monitorEnabled = Boolean(appliedWatch.trim()) || hasEnvVault

  const { data, error, isLoading, isRefreshing, refresh } = useAdminVaultMonitor({
    vaultOverride: appliedWatch.trim() || null,
    enabled: monitorEnabled,
  })

  const activeVaultAddress = (data?.vaultAddress ?? appliedWatch.trim()) || null

  const lastUpdated = useMemo(() => {
    if (!data?.fetchedAt) return null
    try {
      return new Date(data.fetchedAt).toLocaleTimeString()
    } catch {
      return null
    }
  }, [data?.fetchedAt])

  const applyWatchAddress = () => {
    setAppliedWatch(watchAddress.trim())
  }

  return (
    <div className="space-y-6">
      <Card className="border-violet-500/20">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-violet-500" aria-hidden />
                {m.title}
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">{m.subtitle}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data?.apiHealthy ? (
                <Badge variant="secondary" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  {m.apiOk}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300">
                  <XCircle className="h-3 w-3" aria-hidden />
                  {m.apiDown}
                </Badge>
              )}
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  {m.updatedAt.replace('{time}', lastUpdated)}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={isRefreshing || !monitorEnabled}
                onClick={() => void refresh()}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} aria-hidden />
                {m.refresh}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="vault-watch">{m.watchLabel}</Label>
              <Input
                id="vault-watch"
                value={watchAddress}
                onChange={(e) => setWatchAddress(e.target.value)}
                placeholder="C…"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">{m.watchHint}</p>
            </div>
            <Button type="button" onClick={applyWatchAddress} disabled={!watchAddress.trim()}>
              {m.applyWatch}
            </Button>
          </div>

          {!monitorEnabled && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              {m.noVaultToWatch}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {isLoading && monitorEnabled && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          )}

          {data && !isLoading && (
            <>
              {data.alerts.length > 0 && (
                <ul className="space-y-2">
                  {data.alerts.map((alert) => (
                    <li
                      key={alert.id}
                      className={cn(
                        'flex gap-3 rounded-lg border px-3 py-2.5 text-sm',
                        alertStyles(alert.severity),
                      )}
                    >
                      {alertIcon(alert.severity)}
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="mt-0.5 text-xs opacity-90">{alert.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiTile
                  label={m.kpiTvl}
                  value={formatCurrency(data.totals.tvlDisplay)}
                  icon={Landmark}
                />
                <KpiTile
                  label={m.kpiInvested}
                  value={formatCurrency(data.totals.investedDisplay)}
                  icon={TrendingUp}
                />
                <KpiTile
                  label={m.kpiIdle}
                  value={`${formatCurrency(data.totals.idleDisplay)} (${data.totals.idlePercent.toFixed(0)}%)`}
                  icon={Wallet}
                  highlight={data.totals.idlePercent >= 40}
                />
                <KpiTile
                  label={m.kpiApy}
                  value={formatPercent(data.apy)}
                  icon={Activity}
                />
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {data.name}{' '}
                      <span className="text-muted-foreground">({data.symbol})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.networkLabel.replace('{network}', data.network)} ·{' '}
                      {m.feesLabel
                        .replace('{vault}', String(data.feesBps.vaultFee / 100))
                        .replace('{defindex}', String(data.feesBps.defindexFee / 100))}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!data.envConfigured && (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-300">
                        {m.envNotConfigured}
                      </Badge>
                    )}
                    {data.envConfigured && !data.addressMatchesEnv && (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-300">
                        {m.notProductionVault}
                      </Badge>
                    )}
                    {data.envConfigured && data.addressMatchesEnv && (
                      <Badge variant="secondary" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                        {m.liveVault}
                      </Badge>
                    )}
                  </div>
                </div>
                <CopyableCodeLine value={data.vaultAddress} label="vault contract" />
                <Button variant="link" size="sm" className="mt-2 h-auto px-0" asChild>
                  <Link href={data.explorerContractUrl} target="_blank" rel="noreferrer">
                    {m.viewOnExplorer}
                    <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
                  </Link>
                </Button>
              </div>

              <div>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {m.sectionAllocations}
                </h3>
                <div className="space-y-4">
                  {data.assets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{m.noAssets}</p>
                  ) : (
                    data.assets.map((asset) => (
                      <div
                        key={asset.address}
                        className="overflow-hidden rounded-xl border border-border/70"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
                          <div>
                            <p className="font-medium">
                              {asset.symbol}{' '}
                              <span className="text-sm font-normal text-muted-foreground">
                                {asset.name}
                              </span>
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground">{asset.address}</p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-semibold tabular-nums">{formatCurrency(asset.totalDisplay)}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.assetIdleInvested
                                .replace('{idle}', formatCurrency(asset.idleDisplay))
                                .replace('{invested}', formatCurrency(asset.investedDisplay))}
                            </p>
                          </div>
                        </div>
                        {asset.strategies.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                                <th className="px-4 py-2 font-medium">{m.colStrategy}</th>
                                <th className="px-4 py-2 font-medium">{m.colAllocated}</th>
                                <th className="px-4 py-2 font-medium">{m.colStatus}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {asset.strategies.map((s) => (
                                <tr key={s.address} className="border-b border-border/40 last:border-0">
                                  <td className="px-4 py-2.5">
                                    <p className="font-medium">{s.name}</p>
                                    <p className="font-mono text-[10px] text-muted-foreground">{s.address}</p>
                                  </td>
                                  <td className="px-4 py-2.5 tabular-nums">
                                    {formatCurrency(s.allocatedDisplay)}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {s.paused ? (
                                      <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-900 dark:text-amber-200">
                                        <PauseCircle className="h-3 w-3" aria-hidden />
                                        {m.paused}
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                                        {m.active}
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="px-4 py-3 text-sm text-muted-foreground">{m.noStrategies}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {activeVaultAddress && data && (
                <AdminVaultActivation
                  vaultAddress={activeVaultAddress}
                  monitor={data}
                  onSuccess={() => void refresh()}
                />
              )}

              <div>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {m.sectionRoles}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { key: 'manager', label: m.roleManager },
                      { key: 'rebalanceManager', label: m.roleRebalance },
                      { key: 'emergencyManager', label: m.roleEmergency },
                      { key: 'feeReceiver', label: m.roleFeeReceiver },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="rounded-lg border border-border/70 bg-card px-3 py-2.5">
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <p className="mt-1 break-all font-mono text-[11px]">{data.roles[key]}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">{m.autoRefreshHint}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiTile({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card p-4 shadow-sm',
        highlight && 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  )
}
