'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { ADMIN_OPS_NAV, isAdminOpsNavActive } from '@/lib/dashboard/admin-ops-nav'
import { useI18n } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

type AdminSubnavProps = {
  pendingCount?: number
  releaseCount?: number
  vaultConfigured?: boolean
}

export function AdminSubnav({ pendingCount = 0, releaseCount = 0, vaultConfigured = true }: AdminSubnavProps) {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav
      className="mb-8 flex flex-wrap gap-1 rounded-xl border border-border/70 bg-card p-1"
      aria-label={t('adminPage.opsNavLabel')}
    >
      {ADMIN_OPS_NAV.map((item) => {
        const active = isAdminOpsNavActive(pathname, item.href, item.exact)
        const Icon = item.icon
        const showPending = item.href.includes('/approvals') && pendingCount > 0
        const showRelease = item.href.includes('/releases') && releaseCount > 0
        const showVaultDot = item.href.includes('/vault') && !vaultConfigured

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-orange-500/10 text-orange-900 dark:text-orange-200'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {t(item.labelKey)}
            {showPending && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs tabular-nums">
                {pendingCount}
              </Badge>
            )}
            {showRelease && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs tabular-nums">
                {releaseCount}
              </Badge>
            )}
            {showVaultDot && (
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-label={t('adminPage.vaultNeedsSetup')} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
