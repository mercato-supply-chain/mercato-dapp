import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Building2,
  FileCheck,
  History,
  Landmark,
  LayoutDashboard,
  LineChart,
  Package,
  Plus,
  Sprout,
  TrendingUp,
  Unlock,
  UserPlus,
  Users,
  UserCog,
  CheckCircle2,
} from 'lucide-react'

export type UserMenuItem = {
  href: string
  labelKey: string
  /** One-line explanation. Used when a label alone is easy to misread. */
  hintKey?: string
  icon: LucideIcon
  /** Match only the exact path. Needed for `/dashboard` and `/dashboard/admin`. */
  exact?: boolean
}

export type UserMenuGroup = {
  id: string
  titleKey: string
  items: UserMenuItem[]
}

export type UserMenuModel = {
  groups: UserMenuGroup[]
  /**
   * Admin has more destinations than fit in one list. Show one group at a time
   * behind a switcher. Other roles get a single short list.
   */
  switchGroups: boolean
}

const investments: UserMenuItem = {
  href: '/dashboard/investments',
  labelKey: 'dashboardNav.investments',
  icon: LineChart,
}

const vault: UserMenuItem = {
  href: '/dashboard/vault',
  labelKey: 'dashboardNav.vault',
  icon: Sprout,
}

const deals: UserMenuItem = {
  href: '/dashboard/deals',
  labelKey: 'dashboardNav.deals',
  icon: Package,
}

const marketplace: UserMenuItem = {
  href: '/deals',
  labelKey: 'dashboardNav.marketplace',
  icon: TrendingUp,
}

export function getUserMenu(userType: string): UserMenuModel {
  switch (userType) {
    case 'investor':
      return {
        switchGroups: false,
        groups: [
          {
            id: 'go',
            titleKey: 'userMenu.shortcuts',
            items: [investments, marketplace, vault],
          },
        ],
      }
    case 'pyme':
      return {
        switchGroups: false,
        groups: [
          {
            id: 'go',
            titleKey: 'userMenu.shortcuts',
            items: [
              { href: '/create-deal', labelKey: 'dashboardNav.createDeal', icon: Plus },
              deals,
              {
                href: '/deals?filter=funded',
                labelKey: 'dashboardNav.browseInvestors',
                icon: TrendingUp,
              },
              vault,
            ],
          },
        ],
      }
    case 'supplier':
      return {
        switchGroups: false,
        groups: [
          {
            id: 'go',
            titleKey: 'userMenu.shortcuts',
            items: [
              {
                href: '/dashboard/deliveries',
                labelKey: 'dashboardNav.deliveries',
                icon: CheckCircle2,
              },
              deals,
              {
                href: '/dashboard/supplier-profile',
                labelKey: 'dashboardNav.companies',
                icon: Building2,
              },
              {
                href: '/dashboard/referrals',
                labelKey: 'dashboardNav.referrals',
                icon: UserPlus,
              },
            ],
          },
        ],
      }
    case 'admin':
      return {
        switchGroups: true,
        groups: [
          {
            id: 'work',
            titleKey: 'dashboardNav.sectionWork',
            items: [
              {
                href: '/dashboard/admin/approvals',
                labelKey: 'dashboardNav.approvals',
                hintKey: 'userMenu.hintApprovals',
                icon: FileCheck,
              },
              {
                href: '/dashboard/admin/releases',
                labelKey: 'dashboardNav.releaseQueue',
                hintKey: 'userMenu.hintReleases',
                icon: Unlock,
              },
              {
                href: '/dashboard/admin',
                labelKey: 'dashboardNav.adminOverview',
                hintKey: 'userMenu.hintAdminHome',
                icon: LayoutDashboard,
                exact: true,
              },
            ],
          },
          {
            id: 'people',
            titleKey: 'dashboardNav.sectionPeople',
            items: [
              {
                href: '/dashboard/admin/users',
                labelKey: 'dashboardNav.adminUsers',
                hintKey: 'userMenu.hintUsers',
                icon: UserCog,
              },
              {
                href: '/dashboard/admin/leads',
                labelKey: 'dashboardNav.leads',
                hintKey: 'userMenu.hintLeads',
                icon: Users,
              },
              {
                href: '/suppliers',
                labelKey: 'dashboardNav.suppliers',
                hintKey: 'userMenu.hintSuppliers',
                icon: Building2,
              },
            ],
          },
          {
            id: 'insight',
            titleKey: 'dashboardNav.sectionInsight',
            items: [
              {
                href: '/dashboard/admin/analytics',
                labelKey: 'dashboardNav.analytics',
                hintKey: 'userMenu.hintAnalytics',
                icon: BarChart3,
              },
              {
                href: '/dashboard/admin/activity',
                labelKey: 'dashboardNav.activity',
                hintKey: 'userMenu.hintActivity',
                icon: History,
              },
              {
                href: '/dashboard/admin/vault',
                labelKey: 'dashboardNav.vaultMonitor',
                hintKey: 'userMenu.hintVault',
                icon: Landmark,
              },
              deals,
              marketplace,
            ],
          },
        ],
      }
    default:
      return {
        switchGroups: false,
        groups: [
          {
            id: 'go',
            titleKey: 'userMenu.shortcuts',
            items: [
              {
                href: '/dashboard',
                labelKey: 'dashboardNav.overview',
                icon: LayoutDashboard,
                exact: true,
              },
            ],
          },
        ],
      }
  }
}

export function isUserMenuItemActive(pathname: string, item: UserMenuItem): boolean {
  const path = item.href.split('?')[0]
  if (item.exact || item.href.includes('?')) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

/** Group that contains the current page, otherwise the first group. */
export function activeUserMenuGroupId(pathname: string, groups: UserMenuGroup[]): string {
  const match = groups.find((group) => group.items.some((item) => isUserMenuItemActive(pathname, item)))
  return match?.id ?? groups[0]?.id ?? ''
}
