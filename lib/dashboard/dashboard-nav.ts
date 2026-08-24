import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  CheckCircle2,
  FileCheck,
  HandCoins,
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
  Wallet,
} from 'lucide-react'
import type { DashboardRoleKey } from './role-theme'

export type DashboardNavItem = {
  href: string
  labelKey: string
  icon: LucideIcon
  /** Match child routes (default true). Set false for overview home. */
  matchPrefix?: boolean
}

export type DashboardNavSection = {
  titleKey: string
  items: DashboardNavItem[]
}

const overview: DashboardNavItem = {
  href: '/dashboard',
  labelKey: 'dashboardNav.overview',
  icon: LayoutDashboard,
  matchPrefix: false,
}

const wallets: DashboardNavItem = {
  href: '/dashboard/wallets',
  labelKey: 'dashboardNav.wallets',
  icon: Wallet,
}

const vault: DashboardNavItem = {
  href: '/dashboard/vault',
  labelKey: 'dashboardNav.vault',
  icon: Sprout,
}

const deals: DashboardNavItem = {
  href: '/dashboard/deals',
  labelKey: 'dashboardNav.deals',
  icon: Package,
}

const investments: DashboardNavItem = {
  href: '/dashboard/investments',
  labelKey: 'dashboardNav.investments',
  icon: LineChart,
}

const ramp: DashboardNavItem = {
  href: '/dashboard/ramp',
  labelKey: 'dashboardNav.ramp',
  icon: HandCoins,
}

const marketplace: DashboardNavItem = {
  href: '/deals',
  labelKey: 'dashboardNav.marketplace',
  icon: TrendingUp,
}

export function getDashboardNavSections(userType: string): DashboardNavSection[] {
  const role = userType as DashboardRoleKey

  switch (role) {
    case 'investor':
      return [
        {
          titleKey: 'dashboardNav.sectionHome',
          items: [overview],
        },
        {
          titleKey: 'dashboardNav.sectionTreasury',
          items: [wallets, vault, ramp],
        },
        {
          titleKey: 'dashboardNav.sectionPortfolio',
          items: [investments, deals, marketplace],
        },
      ]
    case 'pyme':
      return [
        {
          titleKey: 'dashboardNav.sectionHome',
          items: [overview],
        },
        {
          titleKey: 'dashboardNav.sectionTreasury',
          items: [wallets, vault, ramp],
        },
        {
          titleKey: 'dashboardNav.sectionDeals',
          items: [
            deals,
            { href: '/create-deal', labelKey: 'dashboardNav.createDeal', icon: Plus },
            { href: '/deals?filter=funded', labelKey: 'dashboardNav.browseInvestors', icon: TrendingUp },
          ],
        },
      ]
    case 'supplier':
      return [
        {
          titleKey: 'dashboardNav.sectionHome',
          items: [overview],
        },
        {
          titleKey: 'dashboardNav.sectionTreasury',
          items: [wallets, ramp],
        },
        {
          titleKey: 'dashboardNav.sectionOperations',
          items: [
            deals,
            {
              href: '/dashboard/deliveries',
              labelKey: 'dashboardNav.deliveries',
              icon: CheckCircle2,
            },
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
      ]
    case 'admin':
      return [
        {
          titleKey: 'dashboardNav.sectionHome',
          items: [overview],
        },
        {
          titleKey: 'dashboardNav.sectionOperations',
          items: [
            {
              href: '/dashboard/admin/approvals',
              labelKey: 'dashboardNav.approvals',
              icon: FileCheck,
            },
            {
              href: '/dashboard/admin/releases',
              labelKey: 'dashboardNav.releaseQueue',
              icon: Unlock,
            },
            {
              href: '/dashboard/admin/vault',
              labelKey: 'dashboardNav.vaultMonitor',
              icon: Landmark,
            },
            {
              href: '/dashboard/admin/leads',
              labelKey: 'dashboardNav.leads',
              icon: Users,
            },
          ],
        },
        {
          titleKey: 'dashboardNav.sectionPlatform',
          items: [
            deals,
            marketplace,
            {
              href: '/suppliers',
              labelKey: 'dashboardNav.suppliers',
              icon: Building2,
            },
            ramp,
          ],
        },
      ]
    default:
      return [
        {
          titleKey: 'dashboardNav.sectionHome',
          items: [overview, wallets],
        },
      ]
  }
}

export function isNavItemActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.matchPrefix === false) {
    return pathname === item.href
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
