'use client'

import { useEffect, useState } from 'react'
import { Menu, PanelLeft, PanelLeftClose } from 'lucide-react'
import { Navigation } from '@/components/navigation'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { getRoleTheme } from '@/lib/dashboard/role-theme'
import {
  applySidebarCollapsedToDocument,
  readSidebarCollapsedFromDocument,
  readSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_CSS_VAR,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_WIDTH_EXPANDED,
  writeSidebarCollapsedPreference,
} from '@/lib/dashboard/sidebar-preference'
import { useI18n } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

type DashboardShellProps = {
  userType: string
  children: React.ReactNode
}

export function DashboardShell({ userType, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  // The server render is always expanded. The inline bootstrap script in the
  // dashboard layout applies the stored preference to <html> before paint, and
  // this state is synchronized from it on mount so the layout never flickers.
  const [collapsed, setCollapsed] = useState(false)
  const { t } = useI18n()
  const theme = getRoleTheme(userType)

  useEffect(() => {
    const initial =
      readSidebarCollapsedFromDocument() ?? readSidebarCollapsedPreference() ?? false
    setCollapsed(initial)
    applySidebarCollapsedToDocument(initial)
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== SIDEBAR_COLLAPSED_STORAGE_KEY) return
      const next = readSidebarCollapsedPreference() ?? false
      setCollapsed(next)
      applySidebarCollapsedToDocument(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      writeSidebarCollapsedPreference(next)
      applySidebarCollapsedToDocument(next)
      return next
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <div className="flex flex-1">
        <aside
          id="dashboard-sidebar"
          data-sidebar-collapsed={collapsed ? 'true' : 'false'}
          style={{ width: `var(${SIDEBAR_COLLAPSED_CSS_VAR}, ${SIDEBAR_WIDTH_EXPANDED})` }}
          className={cn(
            'hidden shrink-0 border-r border-border/60 bg-muted/20 transition-[width] duration-200 ease-in-out lg:block',
            'lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto',
          )}
        >
          <div className={cn('flex flex-col', collapsed ? 'p-2' : 'p-4')}>
            <div
              className={cn(
                'mb-4 flex items-center',
                collapsed ? 'justify-center' : 'justify-between gap-2',
              )}
            >
              {!collapsed ? (
                <p
                  className={cn(
                    'min-w-0 flex-1 rounded-xl px-3 py-2 text-xs font-semibold',
                    theme.badge,
                  )}
                >
                  {t(`dashboard.roles.${userType}` as 'dashboard.roles.pyme')}
                </p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
                aria-controls="dashboard-sidebar"
                aria-label={collapsed ? t('dashboardNav.expandSidebar') : t('dashboardNav.collapseSidebar')}
              >
                {collapsed ? (
                  <PanelLeft className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
            <DashboardSidebar userType={userType} collapsed={collapsed} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0" aria-label={t('dashboardNav.openMenu')}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100vw-2rem,18rem)] p-0">
                <SheetTitle className="sr-only">{t('dashboardNav.sidebarLabel')}</SheetTitle>
                <div className="border-b border-border px-4 py-4">
                  <p className="text-sm font-semibold">{t('nav.dashboard')}</p>
                  <p className={cn('mt-1 text-xs', theme.accent)}>
                    {t(`dashboard.roles.${userType}` as 'dashboard.roles.pyme')}
                  </p>
                </div>
                <div className="overflow-y-auto p-4">
                  <DashboardSidebar userType={userType} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-sm font-medium text-muted-foreground">{t('dashboardNav.menuHint')}</span>
          </div>

          <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </div>
  )
}
