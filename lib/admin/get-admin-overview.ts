import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminQueueData } from './get-admin-queue-data'
import { getConfiguredVaultAddress } from './require-admin'
import {
  buildAdminTasks,
  type AdminTaskEntity,
  type AwaitingFundingDeal,
} from './admin-task-rules'
import type { AdminOverviewData } from './types'

/** How many entities feed the inbox per source; counts always use exact totals. */
const TASK_SOURCE_LIMIT = 20

type NamedRow = {
  id: string
  company_name?: string | null
  full_name?: string | null
  contact_name?: string | null
  email?: string | null
  created_at?: string | null
}

function entityName(row: NamedRow): string {
  return row.company_name || row.full_name || row.contact_name || row.email || '—'
}

function toEntities(rows: NamedRow[] | null): AdminTaskEntity[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: entityName(row),
    createdAt: row.created_at ?? null,
  }))
}

/**
 * Assembles the command-center overview. Escrow and release figures reuse
 * getAdminQueueData so every summary count matches its destination queue.
 */
export async function getAdminOverview(
  supabase: SupabaseClient,
): Promise<AdminOverviewData> {
  const [
    queue,
    profilesRes,
    companiesRes,
    onboardingRes,
    awaitingFundingRes,
    activeVolumeRes,
  ] = await Promise.all([
    getAdminQueueData(supabase),
    supabase
      .from('profiles')
      .select('id, company_name, full_name, contact_name, email, created_at', {
        count: 'exact',
      })
      .eq('verified', false)
      .not('user_type', 'is', null)
      .neq('user_type', 'admin')
      .order('created_at', { ascending: true })
      .limit(TASK_SOURCE_LIMIT),
    supabase
      .from('supplier_companies')
      .select('id, company_name, full_name, contact_name, created_at', {
        count: 'exact',
      })
      .eq('verified', false)
      .order('created_at', { ascending: true })
      .limit(TASK_SOURCE_LIMIT),
    supabase
      .from('profiles')
      .select('id, company_name, full_name, contact_name, email, created_at', {
        count: 'exact',
      })
      .is('user_type', null)
      .order('created_at', { ascending: true })
      .limit(TASK_SOURCE_LIMIT),
    supabase
      .from('deals')
      .select('id, title, repayment_status, updated_at, created_at, escrow_contract_address')
      .in('repayment_status', ['escrow_initialized', 'funding'])
      .not('escrow_contract_address', 'is', null),
    supabase
      .from('deals')
      .select('amount', { count: 'exact' })
      .in('status', ['funded', 'in_progress']),
  ])

  const awaitingFundingDeals: AwaitingFundingDeal[] = (
    (awaitingFundingRes.data ?? []) as {
      id: string
      title?: string | null
      repayment_status?: string | null
      updated_at?: string | null
      created_at?: string | null
    }[]
  ).map((deal) => ({
    id: deal.id,
    title: deal.title ?? '—',
    repaymentStatus: deal.repayment_status ?? 'funding',
    updatedAt: deal.updated_at ?? deal.created_at ?? null,
  }))

  const vaultConfigured = Boolean(getConfiguredVaultAddress())

  const tasks = buildAdminTasks(
    {
      queue,
      pendingVerificationProfiles: toEntities(profilesRes.data),
      pendingVerificationCompanies: toEntities(companiesRes.data),
      incompleteOnboardings: toEntities(onboardingRes.data),
      awaitingFundingDeals,
      vaultConfigured,
      // Live vault alerts render inside the vault health card, which reuses
      // the existing DeFindex monitor hook on the client.
      vaultAlerts: [],
    },
    new Date(),
  )

  const activeVolume = ((activeVolumeRes.data ?? []) as { amount: number | null }[]).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  )

  const pendingVerifications =
    (profilesRes.count ?? 0) + (companiesRes.count ?? 0)

  const escrowsById = new Map(
    [...queue.items, ...queue.releaseFallbackItems]
      .filter((item) => item.escrowContractAddress)
      .map((item) => [
        item.escrowContractAddress,
        {
          contractId: item.escrowContractAddress,
          dealId: item.dealId,
          dealTitle: item.dealTitle,
        },
      ]),
  )

  return {
    tasks,
    summary: {
      openTasks: tasks.length,
      escrowsToCreate: queue.createEscrowItems.length,
      milestonesAwaitingApproval: queue.items.length,
      fundsReadyToRelease: queue.releaseFallbackItems.reduce(
        (sum, item) => sum + Number(item.milestoneAmount ?? 0),
        0,
      ),
      releaseQueueCount: queue.releaseFallbackItems.length,
      pendingVerifications,
      incompleteOnboardings: onboardingRes.count ?? 0,
      activeDeals: activeVolumeRes.count ?? 0,
      activeVolume,
    },
    vaultConfigured,
    escrows: [...escrowsById.values()],
  }
}
