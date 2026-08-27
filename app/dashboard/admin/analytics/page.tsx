import { Suspense } from 'react'
import { BarChart3, Database } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AdminAnalyticsRange } from '@/components/dashboard/admin/admin-analytics-range'
import {
  AdminAnalyticsSection,
} from '@/components/dashboard/admin/admin-analytics-section'
import { AdminVaultHealthCard } from '@/components/dashboard/admin/admin-vault-health-card'
import { getAdminAnalytics } from '@/lib/admin/get-admin-analytics'
import { getConfiguredVaultAddress, requireAdminProfile } from '@/lib/admin/require-admin'
import { getServerDictionary, getServerLocale, tr } from '@/lib/i18n/server'

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>

async function resolveSearchParams(searchParams?: SearchParams) {
  if (!searchParams) return {}
  if (typeof (searchParams as Promise<unknown>).then === 'function') {
    return (await searchParams) as Record<string, string | string[] | undefined>
  }
  return searchParams as Record<string, string | string[] | undefined>
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const { supabase } = await requireAdminProfile()
  const params = await resolveSearchParams(searchParams)
  const [data, m, locale] = await Promise.all([
    getAdminAnalytics(
      supabase,
      firstParam(params.range),
      firstParam(params.from),
      firstParam(params.to),
    ),
    getServerDictionary(),
    getServerLocale(),
  ])

  const dateFormat = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">
            {tr(m, 'adminAnalytics.title')}
          </h1>
          <Badge variant="secondary" className="text-xs">
            Admin
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{tr(m, 'adminAnalytics.subtitle')}</p>
      </header>

      <Suspense fallback={null}>
        <AdminAnalyticsRange />
      </Suspense>

      {!data ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <Database className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="font-medium">{tr(m, 'adminAnalytics.unavailableTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(m, 'adminAnalytics.unavailableHint')}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {tr(m, 'adminAnalytics.comparing', {
              from: dateFormat.format(data.range.from),
              to: dateFormat.format(data.range.to),
              prevFrom: dateFormat.format(data.previous.from),
              prevTo: dateFormat.format(data.previous.to),
            })}
          </p>

          <AdminAnalyticsSection
            titleKey="adminAnalytics.usersTitle"
            descriptionKey="adminAnalytics.usersDescription"
            messages={m}
            locale={locale}
            metrics={[
              { labelKey: 'adminAnalytics.metrics.newUsers', pair: data.users.newUsers, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.newPymes', pair: data.users.newPymes, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.newInvestors', pair: data.users.newInvestors, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.newSuppliers', pair: data.users.newSuppliers, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.onboardingCompleted', pair: data.users.onboardingCompleted, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.onboardingConversion', pair: data.users.cohortConversion, format: 'percent' },
              { labelKey: 'adminAnalytics.metrics.medianCompletionTime', pair: data.users.medianCompletionSeconds, format: 'duration' },
            ]}
            chartRows={[
              {
                name: tr(m, 'adminAnalytics.metrics.newUsers'),
                current: data.users.newUsers.current ?? 0,
                previous: data.users.newUsers.previous ?? 0,
              },
              {
                name: tr(m, 'adminAnalytics.metrics.onboardingCompleted'),
                current: data.users.onboardingCompleted.current ?? 0,
                previous: data.users.onboardingCompleted.previous ?? 0,
              },
            ]}
            chartAriaLabelKey="adminAnalytics.usersChartLabel"
            snapshotTitleKey="adminAnalytics.snapshotTitle"
            snapshot={[
              { labelKey: 'adminAnalytics.metrics.totalUsers', value: data.users.snapshot.totalUsers },
              { labelKey: 'adminAnalytics.metrics.pymes', value: data.users.snapshot.pymes },
              { labelKey: 'adminAnalytics.metrics.investors', value: data.users.snapshot.investors },
              { labelKey: 'adminAnalytics.metrics.suppliers', value: data.users.snapshot.suppliers },
              { labelKey: 'adminAnalytics.metrics.onboardingIncomplete', value: data.users.snapshot.onboardingIncomplete },
              { labelKey: 'adminAnalytics.metrics.onboardingCompletedTotal', value: data.users.snapshot.onboardingCompleted },
              { labelKey: 'adminAnalytics.metrics.onboardingLegacy', value: data.users.snapshot.onboardingCompletedLegacy },
              { labelKey: 'adminAnalytics.metrics.verifiedUsers', value: data.users.snapshot.verifiedUsers },
              { labelKey: 'adminAnalytics.metrics.verifiedCompanies', value: data.users.snapshot.verifiedCompanies },
            ]}
          />

          <AdminAnalyticsSection
            titleKey="adminAnalytics.dealsTitle"
            descriptionKey="adminAnalytics.dealsDescription"
            messages={m}
            locale={locale}
            metrics={[
              { labelKey: 'adminAnalytics.metrics.dealsCreated', pair: data.deals.dealsCreated, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.dealsFunded', pair: data.deals.dealsFunded, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.fundingConversion', pair: data.deals.fundingConversion, format: 'percent' },
              { labelKey: 'adminAnalytics.metrics.requestedVolume', pair: data.deals.requestedVolume, format: 'money' },
              { labelKey: 'adminAnalytics.metrics.fundedVolume', pair: data.deals.fundedVolume, format: 'money' },
              { labelKey: 'adminAnalytics.metrics.avgTimeToFunding', pair: data.deals.avgTimeToFundingSeconds, format: 'duration' },
            ]}
            chartRows={[
              {
                name: tr(m, 'adminAnalytics.metrics.dealsCreated'),
                current: data.deals.dealsCreated.current ?? 0,
                previous: data.deals.dealsCreated.previous ?? 0,
              },
              {
                name: tr(m, 'adminAnalytics.metrics.dealsFunded'),
                current: data.deals.dealsFunded.current ?? 0,
                previous: data.deals.dealsFunded.previous ?? 0,
              },
            ]}
            chartAriaLabelKey="adminAnalytics.dealsChartLabel"
            snapshotTitleKey="adminAnalytics.snapshotTitle"
            snapshot={[
              { labelKey: 'adminAnalytics.metrics.totalDeals', value: data.deals.snapshot.totalDeals },
              { labelKey: 'adminAnalytics.metrics.seekingFunding', value: data.deals.snapshot.seekingFunding },
              { labelKey: 'adminAnalytics.metrics.funded', value: data.deals.snapshot.funded },
              { labelKey: 'adminAnalytics.metrics.inProgress', value: data.deals.snapshot.inProgress },
              { labelKey: 'adminAnalytics.metrics.completed', value: data.deals.snapshot.completed },
              { labelKey: 'adminAnalytics.metrics.activeDeals', value: data.deals.snapshot.activeDeals },
              { labelKey: 'adminAnalytics.metrics.activeVolume', value: data.deals.snapshot.activeVolume, format: 'money' },
              { labelKey: 'adminAnalytics.metrics.completedVolume', value: data.deals.snapshot.completedVolume, format: 'money' },
            ]}
          />

          <AdminAnalyticsSection
            titleKey="adminAnalytics.repaymentsTitle"
            descriptionKey="adminAnalytics.repaymentsDescription"
            messages={m}
            locale={locale}
            metrics={[
              { labelKey: 'adminAnalytics.metrics.escrowsCreated', pair: data.repayments.escrowsCreated, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.firstReleases', pair: data.repayments.firstReleases, format: 'count' },
              { labelKey: 'adminAnalytics.metrics.deliveryToEscrow', pair: data.repayments.avgDeliveryToEscrowSeconds, format: 'duration' },
              { labelKey: 'adminAnalytics.metrics.readyToRelease', pair: data.repayments.avgReadyToReleaseSeconds, format: 'duration' },
            ]}
            chartRows={[
              {
                name: tr(m, 'adminAnalytics.metrics.escrowsCreated'),
                current: data.repayments.escrowsCreated.current ?? 0,
                previous: data.repayments.escrowsCreated.previous ?? 0,
              },
              {
                name: tr(m, 'adminAnalytics.metrics.firstReleases'),
                current: data.repayments.firstReleases.current ?? 0,
                previous: data.repayments.firstReleases.previous ?? 0,
              },
            ]}
            chartAriaLabelKey="adminAnalytics.repaymentsChartLabel"
            snapshotTitleKey="adminAnalytics.snapshotTitle"
            snapshot={[
              { labelKey: 'adminAnalytics.metrics.awaitingEscrow', value: data.repayments.snapshot.awaitingEscrow },
              { labelKey: 'adminAnalytics.metrics.awaitingFunding', value: data.repayments.snapshot.awaitingFunding },
              { labelKey: 'adminAnalytics.metrics.readyToReleaseCount', value: data.repayments.snapshot.readyToRelease },
              { labelKey: 'adminAnalytics.metrics.partiallyReleased', value: data.repayments.snapshot.partiallyReleased },
              { labelKey: 'adminAnalytics.metrics.released', value: data.repayments.snapshot.released },
              { labelKey: 'adminAnalytics.metrics.milestonesReleased', value: data.repayments.snapshot.milestonesReleased },
              { labelKey: 'adminAnalytics.metrics.milestonesOpen', value: data.repayments.snapshot.milestonesOpen },
              { labelKey: 'adminAnalytics.metrics.releasedVolume', value: data.repayments.snapshot.releasedVolume, format: 'money' },
            ]}
          />

          <p className="text-xs text-muted-foreground">
            {tr(m, 'adminAnalytics.timingDataNote')}
          </p>
        </>
      )}

      <AdminVaultHealthCard vaultConfigured={Boolean(getConfiguredVaultAddress())} />
    </div>
  )
}
