import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import type { AdminQueueData, AdminQueueFilters, PendingApprovalItem, ReleaseFallbackItem } from './types'
import { repaymentEscrowAmount } from '@/lib/deals/fees'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'

type DealRow = {
  id: string
  title?: string
  product_name?: string | null
  amount: number
  interest_rate?: number | null
  term_days?: number | null
  escrow_contract_address: string | null
  repayment_status?: string | null
  created_at?: string | null
  pyme_id?: string
  supplier_id?: string
  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
  supplier?: { company_name?: string; full_name?: string; contact_name?: string; logo_url?: string | null } | null
}

export async function getAdminQueueData(
  supabase: SupabaseClient,
  filters: AdminQueueFilters = {},
): Promise<AdminQueueData> {
  const m = await getServerDictionary()
  const companyFilter = filters.company ?? null
  const sortOrder = filters.sort ?? 'newest'

  let query = supabase
    .from('deals')
    .select(
      `id, title, product_name, amount, interest_rate, term_days, escrow_contract_address, repayment_status, created_at, pyme_id, supplier_id,
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name),
      supplier:supplier_companies(company_name, full_name, contact_name, logo_url)`,
    )
    .eq('repayment_status', 'funded')
    .not('escrow_contract_address', 'is', null)

  if (companyFilter) {
    if (companyFilter.startsWith('pyme:')) {
      query = query.eq('pyme_id', companyFilter.slice(5))
    } else if (companyFilter.startsWith('supplier:')) {
      query = query.eq('supplier_id', companyFilter.slice(9))
    }
  }

  const { data: dealsRows } = await query
  const dealsList = (dealsRows ?? []) as DealRow[]
  const emptyState = dealsList.length === 0

  let items: PendingApprovalItem[] = []
  const releaseFallbackItems: ReleaseFallbackItem[] = []
  let uniquePymes: { id: string; name: string }[] = []
  let uniqueSuppliers: { id: string; name: string }[] = []

  if (!emptyState) {
    const sortByDealDate = (a: { dealId: string }, b: { dealId: string }) => {
      const dateA = dealsList.find((d) => d.id === a.dealId)?.created_at ?? ''
      const dateB = dealsList.find((d) => d.id === b.dealId)?.created_at ?? ''
      const cmp = dateA < dateB ? -1 : dateA > dateB ? 1 : 0
      return sortOrder === 'newest' ? -cmp : cmp
    }

    items = dealsList.map((deal) => {
      const principal = Number(deal.amount ?? 0)
      const apr = Number(deal.interest_rate ?? 0)
      const termDays = Number(deal.term_days ?? 0)
      const { profit } = computeInvestorReturns(principal, apr, termDays)
      const escrowAmount = repaymentEscrowAmount(principal, profit)
      return {
        dealId: deal.id,
        dealTitle: deal.title ?? tr(m, 'adminPage.fallbackDeal'),
        dealProductName: deal.product_name ?? null,
        dealAmount: escrowAmount,
        escrowContractAddress: deal.escrow_contract_address ?? '',
        milestoneId: `${deal.id}:repayment`,
        milestoneTitle: 'Investor repayment',
        milestoneIndex: 0,
        milestonePercentage: 100,
        milestoneAmount: escrowAmount,
        proofNotes: null,
        proofDocumentUrl: null,
        pymeName:
          deal.pyme?.company_name || deal.pyme?.full_name || deal.pyme?.contact_name || '—',
        supplierName:
          deal.supplier?.company_name ||
          deal.supplier?.full_name ||
          deal.supplier?.contact_name ||
          '—',
        supplierLogoUrl: deal.supplier?.logo_url ?? null,
      }
    })
    items.sort(sortByDealDate)

    uniquePymes = Array.from(
      new Map(
        dealsList
          .filter((d): d is DealRow & { pyme_id: string } => Boolean(d.pyme_id))
          .map((d) => [
            d.pyme_id,
            {
              id: d.pyme_id,
              name:
                d.pyme?.company_name ||
                d.pyme?.full_name ||
                d.pyme?.contact_name ||
                tr(m, 'adminPage.fallbackPyme'),
            },
          ]),
      ).values(),
    )

    uniqueSuppliers = Array.from(
      new Map(
        dealsList
          .filter((d): d is DealRow & { supplier_id: string } => Boolean(d.supplier_id))
          .map((d) => [
            d.supplier_id,
            {
              id: d.supplier_id,
              name:
                d.supplier?.company_name ||
                d.supplier?.full_name ||
                d.supplier?.contact_name ||
                tr(m, 'adminPage.fallbackSupplier'),
            },
          ]),
      ).values(),
    )
  }

  return {
    items,
    releaseFallbackItems,
    uniquePymes,
    uniqueSuppliers,
    emptyState,
    companyFilter,
    sortOrder,
  }
}
