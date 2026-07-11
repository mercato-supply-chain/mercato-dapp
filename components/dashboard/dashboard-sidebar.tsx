'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getDashboardNavSections, isNavItemActive } from '@/lib/dashboard/dashboard-nav'
import { getRoleTheme } from '@/lib/dashboard/role-theme'
import { useI18n } from '@/lib/i18n/provider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const SIDEBAR_COLLAPSED_KEY = 'dashboard-sidebar:collapsed'

type DashboardSidebarProps = {
  userType: string
  className?: string
  collapsed?: boolean
  onNavigate?: () => void
}

export function DashboardSidebar({
  userType,
  className,
  collapsed = false,
  onNavigate,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const sections = getDashboardNavSections(userType)
  const theme = getRoleTheme(userType)

  const nav = (
    <nav
      className={cn('flex flex-col gap-6', collapsed && 'gap-2', className)}
      aria-label={t('dashboardNav.sidebarLabel')}
    >
      {sections.map((section) => (
        <div key={section.titleKey}>
          {!collapsed ? (
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {t(section.titleKey)}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isNavItemActive(pathname, item)
              const Icon = item.icon
              const label = t(item.labelKey)

              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center rounded-xl text-sm font-medium transition-colors',
                    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                    active
                      ? cn('bg-emerald-500/10 text-emerald-800 dark:text-emerald-300', theme.badge)
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active && theme.statIcon)} aria-hidden />
                  {collapsed ? <span className="sr-only">{label}</span> : label}
                </Link>
              )

              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  if (collapsed) {
    return <TooltipProvider delayDuration={0}>{nav}</TooltipProvider>
  }

  return nav
}

export { SIDEBAR_COLLAPSED_KEY }
