import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CheckCircle2,
  FileCheck,
  History,
  Landmark,
  LayoutDashboard,
  UserCog,
  Users,
} from 'lucide-react'

export type AdminOpsNavItem = {
  href: string
  labelKey: string
  icon: LucideIcon
  /** Match only the exact path (for the overview home). */
  exact?: boolean
}

export type AdminOpsGroup = {
  id: string
  titleKey: string
  items: AdminOpsNavItem[]
}

export const ADMIN_OPS_GROUPS: AdminOpsGroup[] = [
  {
    id: 'work',
    titleKey: 'dashboardNav.sectionWork',
    items: [
      { href: '/dashboard/admin', labelKey: 'dashboardNav.adminOverview', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/admin/approvals', labelKey: 'dashboardNav.approvals', icon: FileCheck },
      { href: '/dashboard/admin/releases', labelKey: 'dashboardNav.releaseQueue', icon: CheckCircle2 },
    ],
  },
  {
    id: 'people',
    titleKey: 'dashboardNav.sectionPeople',
    items: [
      { href: '/dashboard/admin/users', labelKey: 'dashboardNav.adminUsers', icon: UserCog },
      { href: '/dashboard/admin/leads', labelKey: 'dashboardNav.leads', icon: Users },
    ],
  },
  {
    id: 'insight',
    titleKey: 'dashboardNav.sectionInsight',
    items: [
      { href: '/dashboard/admin/vault', labelKey: 'dashboardNav.vaultMonitor', icon: Landmark },
      { href: '/dashboard/admin/analytics', labelKey: 'dashboardNav.analytics', icon: BarChart3 },
      { href: '/dashboard/admin/activity', labelKey: 'dashboardNav.activity', icon: History },
    ],
  },
]

export const ADMIN_OPS_NAV: AdminOpsNavItem[] = ADMIN_OPS_GROUPS.flatMap((group) => group.items)

export function isAdminOpsNavActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
