import {
  BadgeCheck,
  CheckCircle2,
  FileCheck,
  Inbox,
  Package,
  Rocket,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import { DashboardStatTile } from '@/components/dashboard/dashboard-stat-tile'
import type { AdminOverviewSummary } from '@/lib/admin/types'
import type { Locale } from '@/lib/i18n/config'
import type { Messages } from '@/lib/i18n/dictionaries'
import { formatMoneyServer, tr } from '@/lib/i18n/server'

type AdminOverviewSummaryProps = {
  summary: AdminOverviewSummary
  messages: Messages
  locale: Locale
}

export function AdminOverviewSummaryGrid({
  summary,
  messages: m,
  locale,
}: AdminOverviewSummaryProps) {
  return (
    <section aria-label={tr(m, 'adminOverview.summaryLabel')}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <DashboardStatTile
          label={tr(m, 'adminOverview.openTasks')}
          value={summary.openTasks}
          icon={Inbox}
          highlight={summary.openTasks > 0}
        />
        <DashboardStatTile
          label={tr(m, 'adminOverview.escrowsToCreate')}
          value={summary.escrowsToCreate}
          icon={Rocket}
          footer={tr(m, 'adminOverview.escrowsToCreateHint')}
        />
        <DashboardStatTile
          label={tr(m, 'adminOverview.awaitingApproval')}
          value={summary.milestonesAwaitingApproval}
          icon={FileCheck}
          footer={tr(m, 'adminOverview.awaitingApprovalHint')}
        />
        <DashboardStatTile
          label={tr(m, 'adminOverview.fundsReadyToRelease')}
          value={formatMoneyServer(locale, summary.fundsReadyToRelease)}
          icon={CheckCircle2}
          footer={tr(m, 'adminOverview.fundsReadyToReleaseHint', {
            count: summary.releaseQueueCount,
          })}
        />
        <DashboardStatTile
          label={tr(m, 'adminOverview.pendingVerifications')}
          value={summary.pendingVerifications}
          icon={BadgeCheck}
        />
        <DashboardStatTile
          label={tr(m, 'adminOverview.incompleteOnboardings')}
          value={summary.incompleteOnboardings}
          icon={UserPlus}
        />
        <DashboardStatTile
          label={tr(m, 'adminOverview.activeDeals')}
          value={summary.activeDeals}
          icon={Package}
        />
        <DashboardStatTile
          label={tr(m, 'adminOverview.activeVolume')}
          value={formatMoneyServer(locale, summary.activeVolume)}
          icon={TrendingUp}
        />
      </div>
    </section>
  )
}
