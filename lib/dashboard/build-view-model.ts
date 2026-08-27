import {
  Building2,
  CheckCircle2,
  DollarSign,
  Package,
  Plus,
  ShieldCheck,
  TrendingUp,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Messages } from '@/lib/i18n/dictionaries'
import type { DashboardAction } from '@/components/dashboard/dashboard-action-grid'
import type { DashboardPayload } from './types'

export type DashboardViewModel = {
  welcome: string
  roleLabel: string
  tagline: string
  companyLine: string | null
  hubLabel: string
  primaryAction?: { label: string; href: string; icon: LucideIcon }
  actions: DashboardAction[]
  dealsViewAllHref: string
  dealsTitle: string
  dealsLabels: {
    title: string
    viewAll: string
    emptyTitle: string
    emptyBody: string
    emptyCta?: string
    emptyCtaHref?: string
    showing: string
    viewAllFooter: string
    dealUntitled: string
    tableDeal: string
    tableStatus: string
    tableAmount: string
    tableSmb: string
    tableSupplier: string
    tableInvestor: string
    tableCompany: string
    tableCreated: string
    tableMilestones: string
    tableFunded: string
    tableView: string
    tableAct: string
    tableApprove: string
    openLabel: string
    milestoneActionNeeded: string
    aprSummary: string
  }
  dealsColumns: {
    showSmb?: boolean
    showSupplier?: boolean
    showInvestor?: boolean
    showCompany?: boolean
    showCreated?: boolean
    showFunded?: boolean
  }
  totalDealsCount: number
  statusLabels: Record<string, string>
}

export function buildDashboardViewModel(
  t: Messages,
  data: DashboardPayload,
): DashboardViewModel {
  const { profile, deals, companyFilterId, supplierCompanies, roleStats, adminStats } = data
  const userType = profile.userType
  const firstName = profile.fullName?.split(' ')[0] || t.dashboard.there

  const welcome = t.dashboard.welcome.replace('{name}', firstName)
  const roleKey = userType as keyof typeof t.dashboard.roles
  const roleLabel =
    roleKey === 'pyme' || roleKey === 'investor' || roleKey === 'supplier' || roleKey === 'admin'
      ? t.dashboard.roles[roleKey]
      : t.dashboard.roles.pyme
  const taglineKey = `${roleKey}Tagline` as keyof typeof t.dashboard.roles
  const tagline =
    taglineKey in t.dashboard.roles
      ? (t.dashboard.roles[taglineKey] as string)
      : t.dashboard.roles.pymeTagline

  const companyLine = profile.companyName
    ? t.dashboard.atCompany.replace('{company}', profile.companyName)
    : null

  let actions: DashboardAction[] = []
  let primaryAction: DashboardViewModel['primaryAction']
  let dealsViewAllHref = '/dashboard/deals'
  let dealsTitle = t.dashboard.recentDeals
  let dealsColumns: DashboardViewModel['dealsColumns'] = { showCreated: true }
  let emptyBody = t.dashboard.noDealsPyme
  let emptyCta: string | undefined = t.dashboard.createDealCta
  let emptyCtaHref: string | undefined = '/create-deal'

  switch (userType) {
    case 'pyme':
      actions = [
        {
          label: t.dashboard.actions.create,
          description: t.dashboard.actions.createDescription,
          href: '/create-deal',
          icon: Plus,
          primary: true,
        },
        {
          label: t.nav.browseInvestors,
          description: t.dashboard.actions.browseInvestorsDescription,
          href: '/deals?filter=funded',
          icon: TrendingUp,
        },
      ]
      primaryAction = { label: t.dashboard.newDeal, href: '/create-deal', icon: Plus }
      emptyBody = t.dashboard.noDealsPyme
      emptyCta = t.dashboard.createDealCta
      emptyCtaHref = '/create-deal'
      break
    case 'investor':
      actions = [
        {
          label: t.nav.browseDeals,
          description: t.dashboard.actions.browseDealsDescription,
          href: '/deals',
          icon: Package,
          primary: true,
        },
        {
          label: t.nav.myInvestments,
          description: t.dashboard.actions.myInvestmentsDescription,
          href: '/dashboard/investments',
          icon: DollarSign,
        },
      ]
      primaryAction = { label: t.nav.browseDeals, href: '/deals', icon: TrendingUp }
      dealsViewAllHref = '/deals'
      dealsColumns = { showSmb: true }
      emptyBody = t.dashboard.noDealsInvestor
      emptyCta = t.dashboard.browseDealsCta
      emptyCtaHref = '/deals'
      break
    case 'supplier':
      actions = [
        {
          label: t.dashboard.actions.confirmDeliveries,
          description: t.dashboard.actions.confirmDeliveriesDescription,
          href: '/dashboard/deliveries',
          icon: CheckCircle2,
          primary: true,
        },
        {
          label: t.dashboard.actions.viewCommercialActivity,
          description: t.dashboard.actions.viewCommercialActivityDescription,
          href: '/dashboard/supplier-activity',
          icon: TrendingUp,
        },
        {
          label: t.dashboard.actions.manageCompanies,
          description: t.dashboard.actions.manageCompaniesDescription,
          href: '/dashboard/supplier-profile',
          icon: Building2,
        },
        {
          label: t.dashboard.actions.viewActiveDeals,
          description: t.dashboard.actions.viewActiveDealsDescription,
          href: '/dashboard/deals',
          icon: TrendingUp,
        },
      ]
      dealsColumns = { showCompany: true, showSmb: true }
      emptyBody =
        supplierCompanies.length === 0
          ? t.dashboard.noDealsSupplierOnboard
          : t.dashboard.noDealsSupplier
      emptyCta =
        supplierCompanies.length === 0 ? t.dashboard.addCompanyProducts : undefined
      emptyCtaHref = supplierCompanies.length === 0 ? '/dashboard/supplier-profile' : undefined
      break
    case 'admin':
      actions = [
        {
          label: t.nav.milestoneApprovals,
          description: t.dashboard.actions.milestoneApprovalsDescription,
          href: '/dashboard/admin/approvals',
          icon: ShieldCheck,
          primary: true,
        },
        {
          label: t.dashboard.actions.browseAllDeals,
          description: t.dashboard.actions.browseAllDealsDescription,
          href: '/deals',
          icon: Package,
        },
      ]
      primaryAction = {
        label: t.dashboard.goApprovals,
        href: '/dashboard/admin/approvals',
        icon: ShieldCheck,
      }
      dealsTitle = t.dashboard.recentPlatformDeals
      dealsViewAllHref = '/deals'
      dealsColumns = {
        showSmb: true,
        showSupplier: true,
        showInvestor: true,
        showFunded: true,
      }
      emptyBody = t.dashboard.noDealsAdmin
      emptyCta = t.dashboard.browseDealsCta
      emptyCtaHref = '/deals'
      break
  }

  const totalDealsCount = roleStats?.total ?? adminStats?.totalDeals ?? deals.length
  const showing = t.dashboard.showingDeals
    .replace('{shown}', String(deals.length))
    .replace('{total}', String(totalDealsCount))

  const statusLabels = t.dealStatus as Record<string, string>

  return {
    welcome,
    roleLabel,
    tagline,
    companyLine,
    hubLabel: t.dashboard.hubLabel,
    primaryAction,
    actions,
    dealsViewAllHref,
    dealsTitle,
    dealsColumns,
    totalDealsCount,
    statusLabels,
    dealsLabels: {
      title: dealsTitle,
      viewAll: t.dashboard.viewAll,
      emptyTitle: t.dashboard.noDealsYet,
      emptyBody,
      emptyCta,
      emptyCtaHref,
      showing,
      viewAllFooter: t.dashboard.viewAllDealsFooter,
      dealUntitled: t.dashboard.dealUntitled,
      tableDeal: t.dashboard.tableDeal,
      tableStatus: t.dashboard.tableStatus,
      tableAmount: t.dashboard.tableAmount,
      tableSmb: t.dashboard.tableSmb,
      tableSupplier: t.dashboard.tableSupplier,
      tableInvestor: t.dashboard.tableInvestor,
      tableCompany: t.dashboard.tableCompany,
      tableCreated: t.dashboard.tableCreated,
      tableFunded: t.dashboard.tableFunded,
      tableMilestones: t.dashboard.tableMilestones,
      tableView: t.dashboard.tableView,
      tableAct: t.dashboard.tableAct,
      tableApprove: t.dashboard.tableApprove,
      openLabel: t.dashboard.openLabel,
      milestoneActionNeeded: t.dashboard.milestoneActionNeeded,
      aprSummary: t.dashboard.aprSummary,
    },
  }
}

export function getDashboardStatTiles(
  t: Messages,
  data: DashboardPayload,
): Array<{
  label: string
  value: number
  icon: LucideIcon
  iconClassName?: string
  highlight?: boolean
  footer?: string
}> {
  const { profile, roleStats, adminStats, supplierCompanies, companyFilterId } = data
  const userType = profile.userType

  if (userType === 'admin' && adminStats) {
    return []
  }

  if (!roleStats) return []

  const tiles: Array<{
    label: string
    value: number
    icon: LucideIcon
    iconClassName?: string
    highlight?: boolean
    footer?: string
  }> = [
    {
      label: t.dashboard.totalDeals,
      value: roleStats.total,
      icon: Package,
      footer:
        userType === 'supplier' && !companyFilterId && supplierCompanies.length > 1
          ? t.dashboard.companiesCount.replace('{count}', String(supplierCompanies.length))
          : undefined,
    },
    { label: t.dashboard.activeDeals, value: roleStats.active, icon: TrendingUp },
    { label: t.dashboard.completed, value: roleStats.completed, icon: CheckCircle2 },
  ]

  if (userType === 'pyme' && roleStats.seekingFunding != null) {
    tiles.splice(1, 0, {
      label: t.dashboard.seekingFunding,
      value: roleStats.seekingFunding,
      icon: DollarSign,
    })
  }

  if (userType === 'supplier' && roleStats.pendingDeliveries != null) {
    tiles.push({
      label: t.dashboard.pendingDeliveries,
      value: roleStats.pendingDeliveries,
      icon: Truck,
      highlight: roleStats.pendingDeliveries > 0,
      footer: roleStats.pendingDeliveries > 0 ? t.dashboard.actions.confirmDeliveries : undefined,
    })
  }

  return tiles
}
