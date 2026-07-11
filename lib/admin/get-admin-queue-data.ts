import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import type {
  AdminQueueData,
  AdminQueueFilters,
  CreateEscrowItem,
  PendingApprovalItem,
  ReleaseFallbackItem,
} from './types'
import {
  repaymentEscrowAmount,
  repaymentMilestoneAmount,
  DEFAULT_FIRST_MILESTONE_PERCENT,
} from '@/lib/deals/fees'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import type { RepaymentMilestoneCache } from '@/lib/types'

type DealRow = {
  id: string
  title?: string
  product_name?: string | null
  amount: number
  interest_rate?: number | null
  term_days?: number | null
  escrow_contract_address: string | null
  repayment_status?: string | null
  repayment_total_amount?: number | null
  repayment_milestones?: RepaymentMilestoneCache[] | null
  created_at?: string | null
  pyme_id?: string
  supplier_id?: string
  investor_id?: string | null
  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
  supplier?: {
    company_name?: string
    full_name?: string
    contact_name?: string
    logo_url?: string | null
  } | null
  investor?: { address?: string | null } | null
}

function companyName(
  row: { company_name?: string; full_name?: string; contact_name?: string } | null | undefined,
  fallback: string,
): string {
  return row?.company_name || row?.full_name || row?.contact_name || fallback
}

export async function getAdminQueueData(
  supabase: SupabaseClient,
  filters: AdminQueueFilters = {},
): Promise<AdminQueueData> {
  const m = await getServerDictionary()
  const companyFilter = filters.company ?? null
  const sortOrder = filters.sort ?? 'newest'

  const selectCols = `id, title, product_name, amount, interest_rate, term_days, escrow_contract_address, repayment_status, repayment_total_amount, repayment_milestones, created_at, pyme_id, supplier_id, investor_id,
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name),
      supplier:supplier_companies(company_name, full_name, contact_name, logo_url),
      investor:profiles!deals_investor_id_fkey(address)`

  let createQuery = supabase
    .from('deals')
    .select(selectCols)
    .eq('repayment_status', 'order_confirmed')

  let releaseQuery = supabase
    .from('deals')
    .select(selectCols)
    .in('repayment_status', [
      'ready_to_release',
      'funded',
      'partially_released',
      'funding',
      'escrow_initialized',
    ])
    .not('escrow_contract_address', 'is', null)

  if (companyFilter) {
    if (companyFilter.startsWith('pyme:')) {
      const id = companyFilter.slice(5)
      createQuery = createQuery.eq('pyme_id', id)
      releaseQuery = releaseQuery.eq('pyme_id', id)
    } else if (companyFilter.startsWith('supplier:')) {
      const id = companyFilter.slice(9)
      createQuery = createQuery.eq('supplier_id', id)
      releaseQuery = releaseQuery.eq('supplier_id', id)
    }
  }

  const [{ data: createRows }, { data: releaseRows }] = await Promise.all([
    createQuery,
    releaseQuery,
  ])

  const createList = (createRows ?? []) as DealRow[]
  const releaseList = (releaseRows ?? []) as DealRow[]

  const sortByDealDate = (a: { dealId: string; createdAt?: string }, b: { dealId: string; createdAt?: string }) => {
    const dateA = a.createdAt ?? ''
    const dateB = b.createdAt ?? ''
    const cmp = dateA < dateB ? -1 : dateA > dateB ? 1 : 0
    return sortOrder === 'newest' ? -cmp : cmp
  }

  const createEscrowItems: CreateEscrowItem[] = createList.map((deal) => {
    const principal = Number(deal.amount ?? 0)
    const apr = Number(deal.interest_rate ?? 0)
    const termDays = Number(deal.term_days ?? 0)
    const { profit } = computeInvestorReturns(principal, apr, termDays)
    const totalGrossed = repaymentEscrowAmount(principal, profit)
    const firstAmount = repaymentMilestoneAmount(
      totalGrossed,
      DEFAULT_FIRST_MILESTONE_PERCENT,
    )
    return {
      dealId: deal.id,
      dealTitle: deal.title ?? tr(m, 'adminPage.fallbackDeal'),
      dealProductName: deal.product_name ?? null,
      principal,
      aprPercent: apr,
      termDays,
      totalGrossed,
      defaultFirstMilestoneAmount: firstAmount,
      investorAddress: deal.investor?.address?.trim() || null,
      pymeName: companyName(deal.pyme, '—'),
      supplierName: companyName(deal.supplier, '—'),
      supplierLogoUrl: deal.supplier?.logo_url ?? null,
      createdAt: deal.created_at ?? undefined,
    }
  })
  createEscrowItems.sort(sortByDealDate)

  const items: PendingApprovalItem[] = []
  for (const deal of releaseList) {
    const principal = Number(deal.amount ?? 0)
    const apr = Number(deal.interest_rate ?? 0)
    const termDays = Number(deal.term_days ?? 0)
    const { profit } = computeInvestorReturns(principal, apr, termDays)
    const totalGrossed =
      deal.repayment_total_amount != null && Number(deal.repayment_total_amount) > 0
        ? Number(deal.repayment_total_amount)
        : repaymentEscrowAmount(principal, profit)

    const milestones = Array.isArray(deal.repayment_milestones)
      ? deal.repayment_milestones
      : []
    const open = milestones.filter((m) => !m.released)
    const remaining = Math.max(
      0,
      totalGrossed - milestones.reduce((s, x) => s + Number(x.amount ?? 0), 0),
    )

    // Show open milestones for release; if cache empty but status says ready, show index 0.
    // If all scheduled milestones are released but amount remains, show a placeholder for add-next.
    let toShow = open
    if (toShow.length === 0) {
      if (
        deal.repayment_status === 'ready_to_release' ||
        deal.repayment_status === 'funded'
      ) {
        toShow = [
          {
            index: 0,
            description: 'Investor repayment',
            amount: totalGrossed,
            released: false,
          },
        ]
      } else if (remaining > 0.01) {
        toShow = [
          {
            index: Math.max(0, milestones.length - 1),
            description: 'Add next repayment milestone',
            amount: remaining,
            released: true,
          },
        ]
      }
    }

    for (const ms of toShow) {
      const pct =
        totalGrossed > 0 ? Math.round((ms.amount / totalGrossed) * 1000) / 10 : 0
      items.push({
        dealId: deal.id,
        dealTitle: deal.title ?? tr(m, 'adminPage.fallbackDeal'),
        dealProductName: deal.product_name ?? null,
        dealAmount: totalGrossed,
        escrowContractAddress: deal.escrow_contract_address ?? '',
        milestoneId: `${deal.id}:repayment:${ms.index}:${ms.released ? 'add' : 'open'}`,
        milestoneTitle: ms.description || `Repayment #${ms.index + 1}`,
        milestoneIndex: ms.index,
        milestonePercentage: pct,
        milestoneAmount: ms.amount,
        proofNotes: null,
        proofDocumentUrl: null,
        pymeName: companyName(deal.pyme, '—'),
        supplierName: companyName(deal.supplier, '—'),
        supplierLogoUrl: deal.supplier?.logo_url ?? null,
        repaymentStatus: deal.repayment_status ?? null,
        investorAddress: deal.investor?.address?.trim() || null,
        remainingToSchedule: remaining,
        createdAt: deal.created_at ?? undefined,
      })
    }
  }
  items.sort(sortByDealDate)

  const releaseFallbackItems: ReleaseFallbackItem[] = []

  const allForFilters = [...createList, ...releaseList]
  const uniquePymes = Array.from(
    new Map(
      allForFilters
        .filter((d): d is DealRow & { pyme_id: string } => Boolean(d.pyme_id))
        .map((d) => [
          d.pyme_id,
          {
            id: d.pyme_id,
            name: companyName(d.pyme, tr(m, 'adminPage.fallbackPyme')),
          },
        ]),
    ).values(),
  )

  const uniqueSuppliers = Array.from(
    new Map(
      allForFilters
        .filter((d): d is DealRow & { supplier_id: string } => Boolean(d.supplier_id))
        .map((d) => [
          d.supplier_id,
          {
            id: d.supplier_id,
            name: companyName(d.supplier, tr(m, 'adminPage.fallbackSupplier')),
          },
        ]),
    ).values(),
  )

  const emptyState = createEscrowItems.length === 0 && items.length === 0

  return {
    items,
    createEscrowItems,
    releaseFallbackItems,
    uniquePymes,
    uniqueSuppliers,
    emptyState,
    companyFilter,
    sortOrder,
  }
}
