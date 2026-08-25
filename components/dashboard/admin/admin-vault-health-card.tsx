'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, Landmark, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminVaultMonitor } from '@/hooks/use-admin-vault-monitor'
import { formatCurrency, formatPercent } from '@/lib/format'
import { useI18n } from '@/lib/i18n/provider'

type AdminVaultHealthCardProps = {
  vaultConfigured: boolean
}

/** Compact vault snapshot reusing the existing DeFindex monitor endpoint. */
export function AdminVaultHealthCard({ vaultConfigured }: AdminVaultHealthCardProps) {
  const { t } = useI18n()
  const { data, error, isLoading } = useAdminVaultMonitor({
    enabled: vaultConfigured,
    pollMs: 60_000,
  })

  const criticalAlerts = data?.alerts.filter((a) => a.severity === 'critical') ?? []
  const warningAlerts = data?.alerts.filter((a) => a.severity === 'warning') ?? []

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4" aria-hidden />
          {t('adminOverview.vaultHealth')}
          {vaultConfigured && criticalAlerts.length === 0 && !isLoading && !error && (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-300/60 bg-emerald-500/10 text-[11px] text-emerald-800 dark:border-emerald-800/50 dark:text-emerald-300"
            >
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {t('adminOverview.vaultHealthy')}
            </Badge>
          )}
          {criticalAlerts.length > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-red-300/60 bg-red-500/10 text-[11px] text-red-800 dark:border-red-800/50 dark:text-red-300"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {t('adminOverview.vaultAlerts', { count: criticalAlerts.length })}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t('adminOverview.vaultLive')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!vaultConfigured ? (
          <p className="text-sm text-muted-foreground">
            {t('adminOverview.vaultUnconfiguredHint')}
          </p>
        ) : isLoading ? (
          <div className="space-y-2" aria-busy>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />
          </div>
        ) : error || !data ? (
          <p className="text-sm text-muted-foreground">
            {t('adminOverview.vaultUnavailable')}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t('adminOverview.vaultTvl')}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(data.totals.tvlDisplay)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t('adminOverview.vaultIdle')}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatPercent(data.totals.idlePercent)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t('adminOverview.vaultApy')}
                </dt>
                <dd className="font-medium tabular-nums">{formatPercent(data.apy)}</dd>
              </div>
            </dl>
            {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {[...criticalAlerts, ...warningAlerts].slice(0, 3).map((alert) => (
                  <li key={alert.id} className="flex items-start gap-1.5">
                    <AlertTriangle
                      className="mt-0.5 h-3 w-3 shrink-0 text-amber-500"
                      aria-hidden
                    />
                    {alert.title}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <Link
          href="/dashboard/admin/vault"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t('adminOverview.openVaultMonitor')}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  )
}
