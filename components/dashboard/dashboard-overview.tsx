import { AdminDashboard } from '@/components/dashboard/admin/admin-dashboard'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DashboardStatTile } from '@/components/dashboard/dashboard-stat-tile'
import { DashboardActionGrid } from '@/components/dashboard/dashboard-action-grid'
import { DashboardSupplierCatalog } from '@/components/dashboard/dashboard-supplier-catalog'
import { buildDashboardViewModel, getDashboardStatTiles } from '@/lib/dashboard/build-view-model'
import { getRoleTheme } from '@/lib/dashboard/role-theme'
import type { DashboardPayload } from '@/lib/dashboard/types'
import type { Messages } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

type DashboardOverviewProps = {
  data: DashboardPayload
  t: Messages
}

export function DashboardOverview({ data, t }: DashboardOverviewProps) {
  const vm = buildDashboardViewModel(t, data)
  const statTiles = getDashboardStatTiles(t, data)
  const { profile, supplierCompanies, supplierProductsForCard, adminStats, companyFilterId } = data
  const userType = profile.userType
  const theme = getRoleTheme(userType)
  const showSupplierCatalog = userType === 'supplier'

  if (userType === 'admin' && adminStats) {
    return <AdminDashboard data={data} t={t} />
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 px-4 py-8">
      <DashboardHero
        userType={userType}
        hubLabel={vm.hubLabel}
        welcome={vm.welcome}
        roleLabel={vm.roleLabel}
        tagline={vm.tagline}
        companyLine={vm.companyLine}
        primaryAction={
          vm.primaryAction
            ? {
                label: vm.primaryAction.label,
                href: vm.primaryAction.href,
                icon: <vm.primaryAction.icon className="mr-2 h-4 w-4" />,
              }
            : undefined
        }
      />

      {statTiles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statTiles.map((tile) => (
            <DashboardStatTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              icon={tile.icon}
              iconClassName={cn(theme.statIcon, tile.iconClassName)}
              highlight={tile.highlight}
              footer={tile.footer}
            />
          ))}
        </div>
      )}

      <DashboardActionGrid
        userType={userType}
        title={t.dashboard.handyActions}
        actions={vm.actions}
      />

      {showSupplierCatalog && (
        <DashboardSupplierCatalog
          products={supplierProductsForCard}
          hasCompanies={supplierCompanies.length > 0}
          showCatalog={Boolean(companyFilterId || supplierCompanies.length === 1)}
          labels={{
            title: t.dashboard.supplierCardTitle,
            descAll: t.dashboard.supplierCardDescAll,
            descPickCompany: t.dashboard.supplierCardDescPickCompany,
            categories: t.dashboard.categories,
            products: t.dashboard.products,
            moreProducts: t.dashboard.moreProducts,
            noProductsCompany: t.dashboard.supplierNoProductsCompany,
            hintNoCompanies: t.dashboard.supplierHintNoCompanies,
            hintPickCompany: t.dashboard.supplierHintPickCompany,
            manageCatalog: t.dashboard.manageCatalog,
          }}
        />
      )}
    </div>
  )
}
