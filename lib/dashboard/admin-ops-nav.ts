import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, FileCheck, Landmark, Users } from 'lucide-react'

export type AdminOpsNavItem = {
  href: string
  labelKey: string
  icon: LucideIcon
}

export const ADMIN_OPS_NAV: AdminOpsNavItem[] = [
  { href: '/dashboard/admin/approvals', labelKey: 'dashboardNav.approvals', icon: FileCheck },
  { href: '/dashboard/admin/releases', labelKey: 'dashboardNav.releaseQueue', icon: CheckCircle2 },
  { href: '/dashboard/admin/vault', labelKey: 'dashboardNav.vaultMonitor', icon: Landmark },
  { href: '/dashboard/admin/leads', labelKey: 'dashboardNav.leads', icon: Users },
]

export function isAdminOpsNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
