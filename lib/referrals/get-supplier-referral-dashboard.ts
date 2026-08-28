import type { SupabaseClient } from '@supabase/supabase-js'
import { groupReferralActivityItems, type ReferralActivityItem } from './activity-grouping'
import { computeConversionRate } from './invitation-metrics'
import { pickReferralPymePublicFields } from './privacy'
import { getReferredPymeStatus, type ReferredPymeStatus } from './referred-pyme-status'

export type ReferralDashboardFilters = {
  companyId?: string | null
  status?: ReferredPymeStatus | null
  from?: string | null
  to?: string | null
}

export type ReferralSummaryMetrics = {
  invitationsCreated: number
  validInvitations: number
  linkOpens: number
  accountsCreated: number
  onboardedPymes: number
  conversionRate: number
  referredPymes: number
  activeReferredPymes: number
  requestedVolume: number
  fundedVolume: number
}

export type ReferralInvitationView = {
  id: string
  supplierCompanyId: string
  companyName: string | null
  label: string | null
  recipientEmail: string | null
  status: string
  expiresAt: string | null
  convertedProfileId: string | null
  revokedAt: string | null
  createdAt: string
  linkOpenCount: number
}

export type ReferredPymeView = {
  profileId: string | null
  supplierCompanyId: string
  supplierCompanyName: string | null
  referralInvitationId: string | null
  attributionSource: 'invitation' | 'legacy'
  status: ReferredPymeStatus
  dealCount: number
  requestedVolume: number
  fundedVolume: number
  createdAt: string | null
  profile: ReturnType<typeof pickReferralPymePublicFields>
}

export type ReferralNetworkBreakdown = {
  byCountry: Array<{ key: string; count: number }>
  bySector: Array<{ key: string; count: number }>
}

export type SupplierReferralDashboardData = {
  summary: ReferralSummaryMetrics
  invitations: { total: number; rows: ReferralInvitationView[] }
  referredPymes: { total: number; rows: ReferredPymeView[] }
  activity: { total: number; rows: ReferralActivityItem[] }
  network: ReferralNetworkBreakdown
  companies: Array<{ id: string; company_name: string | null }>
}

type PageOpts = { invitationsPage?: number; pymesPage?: number; activityPage?: number; pageSize?: number }

export async function getSupplierReferralDashboard(
  supabase: SupabaseClient,
  ownerId: string,
  filters: ReferralDashboardFilters = {},
  pages: PageOpts = {},
): Promise<SupplierReferralDashboardData> {
  const pageSize = pages.pageSize ?? 20
  const invPage = pages.invitationsPage ?? 1
  const pymePage = pages.pymesPage ?? 1
  const actPage = pages.activityPage ?? 1
  const companyId = filters.companyId ?? null

  const { data: companies } = await supabase
    .from('supplier_companies')
    .select('id, company_name')
    .eq('owner_id', ownerId)
    .order('company_name')

  if (companyId && !(companies ?? []).some((c) => c.id === companyId)) {
    throw new Error('Invalid company filter')
  }

  const rpcArgs = {
    p_owner_id: ownerId,
    p_company_id: companyId,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
  }

  const [summaryRes, invitationsRes, pymesRes, activityRes, networkRes] = await Promise.all([
    supabase.rpc('get_supplier_referral_summary', rpcArgs),
    supabase.rpc('get_supplier_referral_invitations_page', {
      p_owner_id: ownerId,
      p_company_id: companyId,
      p_limit: pageSize,
      p_offset: (invPage - 1) * pageSize,
    }),
    supabase.rpc('get_supplier_referred_pymes_page', {
      p_owner_id: ownerId,
      p_company_id: companyId,
      p_limit: pageSize,
      p_offset: (pymePage - 1) * pageSize,
    }),
    supabase.rpc('get_supplier_referral_activity_page', {
      p_owner_id: ownerId,
      p_company_id: companyId,
      p_limit: pageSize,
      p_offset: (actPage - 1) * pageSize,
    }),
    supabase.rpc('get_supplier_referral_network_breakdown', {
      p_owner_id: ownerId,
      p_company_id: companyId,
    }),
  ])

  if (summaryRes.error) throw summaryRes.error
  if (invitationsRes.error) throw invitationsRes.error
  if (pymesRes.error) throw pymesRes.error
  if (activityRes.error) throw activityRes.error
  if (networkRes.error) throw networkRes.error

  const summaryRaw = summaryRes.data as Record<string, number>
  const summary: ReferralSummaryMetrics = {
    invitationsCreated: summaryRaw.invitationsCreated ?? 0,
    validInvitations: summaryRaw.validInvitations ?? 0,
    linkOpens: summaryRaw.linkOpens ?? 0,
    accountsCreated: summaryRaw.accountsCreated ?? 0,
    onboardedPymes: summaryRaw.onboardedPymes ?? 0,
    conversionRate: computeConversionRate(
      summaryRaw.onboardedPymes ?? 0,
      summaryRaw.validInvitations ?? 0,
    ),
    referredPymes: summaryRaw.referredPymes ?? 0,
    activeReferredPymes: summaryRaw.activeReferredPymes ?? 0,
    requestedVolume: Number(summaryRaw.requestedVolume ?? 0),
    fundedVolume: Number(summaryRaw.fundedVolume ?? 0),
  }

  const invitationsPayload = invitationsRes.data as { total: number; rows: Record<string, unknown>[] }
  const invitations: ReferralInvitationView[] = (invitationsPayload.rows ?? []).map((row) => ({
    id: String(row.id),
    supplierCompanyId: String(row.supplier_company_id),
    companyName: (row.company_name as string | null) ?? null,
    label: (row.label as string | null) ?? null,
    recipientEmail: (row.recipient_email as string | null) ?? null,
    status: String(row.status),
    expiresAt: (row.expires_at as string | null) ?? null,
    convertedProfileId: (row.converted_profile_id as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    createdAt: String(row.created_at),
    linkOpenCount: Number(row.link_open_count ?? 0),
  }))

  const pymesPayload = pymesRes.data as { total: number; rows: Record<string, unknown>[] }
  let referredPymes: ReferredPymeView[] = (pymesPayload.rows ?? []).map((row) => {
    const profileSnapshot = {
      id: row.profile_id as string | null,
      user_type: row.user_type as string | null,
      company_name: row.company_name as string | null,
      country: row.country as string | null,
      sector: row.sector as string | null,
    }
    const dealCount = Number(row.deal_count ?? 0)
    return {
      profileId: (row.profile_id as string | null) ?? null,
      supplierCompanyId: String(row.supplier_company_id),
      supplierCompanyName: (row.supplier_company_name as string | null) ?? null,
      referralInvitationId: (row.referral_invitation_id as string | null) ?? null,
      attributionSource: row.attribution_source === 'legacy' ? 'legacy' : 'invitation',
      status: getReferredPymeStatus(profileSnapshot, dealCount),
      dealCount,
      requestedVolume: Number(row.requested_volume ?? 0),
      fundedVolume: Number(row.funded_volume ?? 0),
      createdAt: (row.created_at as string | null) ?? null,
      profile: pickReferralPymePublicFields(row),
    }
  })

  if (filters.status) {
    referredPymes = referredPymes.filter((row) => row.status === filters.status)
  }

  const activityPayload = activityRes.data as { total: number; rows: Record<string, unknown>[] }
  const activityRows: ReferralActivityItem[] = (activityPayload.rows ?? []).map((row) => ({
    id: String(row.id),
    eventType: row.event_type as ReferralActivityItem['eventType'],
    createdAt: String(row.created_at),
    profileId: (row.profile_id as string | null) ?? null,
    invitationId: (row.invitation_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }))
  const groupedActivity = groupReferralActivityItems(activityRows)

  const networkRaw = networkRes.data as {
    byCountry?: Array<{ key: string; count: number }>
    bySector?: Array<{ key: string; count: number }>
  }

  return {
    summary,
    invitations: { total: invitationsPayload.total ?? 0, rows: invitations },
    referredPymes: { total: pymesPayload.total ?? 0, rows: referredPymes },
    activity: { total: activityPayload.total ?? 0, rows: groupedActivity },
    network: {
      byCountry: networkRaw.byCountry ?? [],
      bySector: networkRaw.bySector ?? [],
    },
    companies: companies ?? [],
  }
}
