import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Package,
  ShieldCheck,
  Landmark,
  Unlock,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { getRoleTheme } from '@/lib/dashboard/role-theme'
import type { Messages } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

type AdminOperationsGridProps = {
  t: Messages
}

type Op = { label: string; description: string; href: string; icon: LucideIcon; primary?: boolean }

export function AdminOperationsGrid({ t }: AdminOperationsGridProps) {
  const m = t.adminDashboard
  const theme = getRoleTheme('admin')

  const operations: Op[] = [
    { label: m.opApprovals, description: m.opApprovalsDesc, href: '/dashboard/admin/approvals', icon: ShieldCheck, primary: true },
    { label: m.opRelease, description: m.opReleaseDesc, href: '/dashboard/admin/releases', icon: Unlock },
    { label: m.opDeals, description: m.opDealsDesc, href: '/dashboard/deals', icon: Package },
    { label: m.opMarketplace, description: m.opMarketplaceDesc, href: '/deals', icon: Package },
    { label: m.opSuppliers, description: m.opSuppliersDesc, href: '/suppliers', icon: Building2 },
    { label: m.opRamp, description: m.opRampDesc, href: '/dashboard/ramp', icon: Wallet },
    {
      label: m.opVaultMonitor,
      description: m.opVaultMonitorDesc,
      href: '/dashboard/admin/vault',
      icon: Landmark,
    },
    {
      label: m.opLeads,
      description: m.opLeadsDesc,
      href: '/dashboard/admin/leads',
      icon: Users,
    },
  ]

  return (
    <div>
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {t.dashboard.handyActions}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {operations.map((op) => {
          const Icon = op.icon
          return (
            <Link
              key={op.href + op.label}
              href={op.href}
              className={cn(
                'group flex flex-col justify-between rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md',
                op.primary ? theme.actionPrimary : 'border-border/70 bg-card hover:border-border',
                op.primary && 'sm:col-span-2',
              )}
            >
              <div>
                <div
                  className={cn(
                    'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
                    op.primary ? 'bg-orange-600 text-white' : 'bg-muted',
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <p className="font-semibold leading-snug">{op.label}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{op.description}</p>
              </div>
              <span className={cn('mt-4 inline-flex items-center gap-1 text-sm font-medium', theme.accent)}>
                {t.dashboard.openLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
