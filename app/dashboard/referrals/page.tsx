import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getServerDictionary } from '@/lib/i18n/server'
import { getSupplierReferralDashboard } from '@/lib/referrals/get-supplier-referral-dashboard'
import type { ReferredPymeStatus } from '@/lib/referrals/referred-pyme-status'
import { ReferralSummaryCards } from '@/components/referrals/summary-cards'
import { ReferralFiltersForm } from '@/components/referrals/filters-form'
import { ReferralInvitationsSection } from '@/components/referrals/invitations-section'
import { ReferredPymesTable } from '@/components/referrals/referred-pymes-table'
import { ReferralActivityTimeline } from '@/components/referrals/activity-timeline'
import { ReferralNetworkBreakdownTables } from '@/components/referrals/network-breakdown'

type SearchParams = Promise<{
  company?: string
  status?: string
  from?: string
  to?: string
  invPage?: string
  pymePage?: string
  actPage?: string
}> | {
  company?: string
  status?: string
  from?: string
  to?: string
  invPage?: string
  pymePage?: string
  actPage?: string
}

const STATUS_KEYS: ReferredPymeStatus[] = [
  'invited',
  'account_created',
  'onboarding_incomplete',
  'inactive',
  'active',
]

function parsePage(value: string | undefined) {
  const n = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export default async function ReferralsPage({ searchParams }: { searchParams?: SearchParams }) {
  const m = await getServerDictionary()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'supplier') {
    redirect('/dashboard')
  }

  const params =
    searchParams && typeof (searchParams as Promise<unknown>).then === 'function'
      ? await (searchParams as Promise<Record<string, string | undefined>>)
      : (searchParams as Record<string, string | undefined>) ?? {}

  const companyId = params.company && params.company !== 'all' ? params.company : null
  const statusParam = params.status && params.status !== 'all' ? params.status : null
  const statusFilter = STATUS_KEYS.includes(statusParam as ReferredPymeStatus)
    ? (statusParam as ReferredPymeStatus)
    : null

  const from = params.from ? `${params.from}T00:00:00.000Z` : null
  const to = params.to ? `${params.to}T23:59:59.999Z` : null

  const invPage = parsePage(params.invPage)
  const pymePage = parsePage(params.pymePage)
  const actPage = parsePage(params.actPage)
  const pageSize = 20

  const data = await getSupplierReferralDashboard(
    supabase,
    user.id,
    { companyId, status: statusFilter, from, to },
    { invitationsPage: invPage, pymesPage: pymePage, activityPage: actPage, pageSize },
  )

  const statusLabels: Record<ReferredPymeStatus, string> = {
    invited: m.referrals.status.invited,
    account_created: m.referrals.status.accountCreated,
    onboarding_incomplete: m.referrals.status.onboardingIncomplete,
    inactive: m.referrals.status.inactive,
    active: m.referrals.status.active,
  }

  const baseQueryParts: string[] = []
  if (companyId) baseQueryParts.push(`company=${encodeURIComponent(companyId)}`)
  if (statusFilter) baseQueryParts.push(`status=${encodeURIComponent(statusFilter)}`)
  if (params.from) baseQueryParts.push(`from=${encodeURIComponent(params.from)}`)
  if (params.to) baseQueryParts.push(`to=${encodeURIComponent(params.to)}`)
  const baseQuery = baseQueryParts.join('&')

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{m.referrals.page.title}</h1>
        <p className="mt-1 text-muted-foreground">{m.referrals.page.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">{m.referrals.page.privacyNote}</p>
      </div>

      <ReferralFiltersForm
        companies={data.companies}
        labels={m.referrals.filters}
        statusLabels={statusLabels}
        values={{
          company: companyId ?? 'all',
          status: statusFilter ?? 'all',
          from: params.from,
          to: params.to,
        }}
      />

      <ReferralSummaryCards summary={data.summary} labels={m.referrals.summary} />

      <ReferralNetworkBreakdownTables
        network={data.network}
        labels={m.referrals.network}
        countryLabels={m.geo.countries as Record<string, string>}
        sectorLabels={m.geo.sectors as Record<string, string>}
      />

      <ReferralInvitationsSection
        invitations={data.invitations.rows}
        companies={data.companies}
        page={invPage}
        total={data.invitations.total}
        pageSize={pageSize}
        baseQuery={baseQuery}
        labels={{
          ...m.referrals.invitations,
          statusLabels: m.referrals.invitationStatus as Record<string, string>,
        }}
      />

      <ReferredPymesTable
        rows={data.referredPymes.rows}
        labels={{
          ...m.referrals.referredPymes,
          statusLabels,
        }}
        page={pymePage}
        total={data.referredPymes.total}
        pageSize={pageSize}
        baseQuery={baseQuery}
      />

      <ReferralActivityTimeline
        items={data.activity.rows}
        labels={{
          title: m.referrals.activity.title,
          empty: m.referrals.activity.empty,
          openedTimes: m.referrals.activity.openedTimes,
          eventLabels: m.referrals.activity.events as Record<string, string>,
        }}
        page={actPage}
        total={data.activity.total}
        pageSize={pageSize}
        baseQuery={baseQuery}
      />
    </div>
  )
}
