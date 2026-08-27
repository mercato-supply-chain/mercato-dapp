import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchInvestorWalletForDeal } from '@/lib/deals/investor-wallet'
import { reconcileRepaymentFromIndexer } from '@/lib/deals/repayment-escrow-helpers'
import type {
  DealRepository,
  IndexerPort,
  SyncDealFromIndexerOptions,
  SyncDealFromIndexerResult,
} from '@/lib/deals/repayment-escrow-types'
import type { RetryPolicy, WaitFn } from '@/lib/deals/repayment-retry'

export function createSupabaseDealRepository(
  supabase: SupabaseClient,
): DealRepository {
  return {
    async getRepaymentDueAt(dealId) {
      const { data } = await supabase
        .from('deals')
        .select('repayment_due_at')
        .eq('id', dealId)
        .single()
      return data?.repayment_due_at ?? null
    },
    async getRepaymentTotal(dealId) {
      const { data } = await supabase
        .from('deals')
        .select('repayment_total_amount')
        .eq('id', dealId)
        .single()
      return Number(data?.repayment_total_amount ?? 0)
    },
    async updateDeal(dealId, patch) {
      const { error } = await supabase.from('deals').update(patch).eq('id', dealId)
      if (error) throw error
    },
    resolveInvestorWallet(dealId) {
      return fetchInvestorWalletForDeal(supabase, dealId)
    },
  }
}

export async function syncDealFromIndexer(
  indexer: IndexerPort,
  deals: DealRepository,
  wait: WaitFn,
  policy: RetryPolicy,
  dealId: string,
  contractId: string,
  extras?: Record<string, unknown>,
  options?: SyncDealFromIndexerOptions,
): Promise<SyncDealFromIndexerResult> {
  const retryOnEmpty = options?.retryOnEmptyMilestones ?? true
  let escrow = await indexer.getByContractId(contractId)
  if (retryOnEmpty && !escrow?.milestones?.length) {
    const { extraAttempts, delayMs } = policy.indexerEmptyMilestones
    for (let attempt = 0; attempt < extraAttempts; attempt++) {
      await wait(delayMs)
      escrow = await indexer.getByContractId(contractId)
      if (escrow?.milestones?.length) break
    }
  }
  let balance = Number(escrow?.balance ?? 0)
  try {
    const lookedUp = await indexer.getBalance(contractId)
    if (lookedUp != null) {
      balance = lookedUp
    }
  } catch {
    // Indexer balance is fine as fallback
  }
  const totalGrossed = await deals.getRepaymentTotal(dealId)
  const { milestones, status } = reconcileRepaymentFromIndexer(
    escrow,
    balance,
    totalGrossed,
  )
  await deals.updateDeal(dealId, {
    repayment_milestones: milestones,
    repayment_status: status,
    escrow_status:
      status === 'released'
        ? 'completed'
        : status === 'escrow_initialized'
          ? 'initialized'
          : 'active',
    ...(status === 'released'
      ? {
          status: 'completed',
          completed_at: new Date().toISOString(),
        }
      : {}),
    ...extras,
  })
  return { milestones, status, balance }
}
