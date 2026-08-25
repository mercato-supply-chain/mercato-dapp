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

export const ADMIN_OPS_NAV: AdminOpsNavItem[] = [
  { href: '/dashboard/admin', labelKey: 'dashboardNav.overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/admin/users', labelKey: 'dashboardNav.adminUsers', icon: UserCog },
  { href: '/dashboard/admin/approvals', labelKey: 'dashboardNav.approvals', icon: FileCheck },
  { href: '/dashboard/admin/releases', labelKey: 'dashboardNav.releaseQueue', icon: CheckCircle2 },
  { href: '/dashboard/admin/vault', labelKey: 'dashboardNav.vaultMonitor', icon: Landmark },
  { href: '/dashboard/admin/analytics', labelKey: 'dashboardNav.analytics', icon: BarChart3 },
  { href: '/dashboard/admin/activity', labelKey: 'dashboardNav.activity', icon: History },
  { href: '/dashboard/admin/leads', labelKey: 'dashboardNav.leads', icon: Users },
]

export function isAdminOpsNavActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
