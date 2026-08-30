import { createClient } from '@/lib/supabase/client'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import { repaymentEscrowAmount } from '@/lib/deals/fees'
import {
  REPAYMENT_QUEUE_DEAL_SELECT,
  type RepaymentQueueDealRow,
} from '@/lib/admin/repayment-queue-select'
import type {
  RepaymentEscrowDeploymentDraft,
  TrustlessConfigSnapshot,
} from './repayment-deployment-draft'

export type StaleFieldDiff = {
  readonly field: string
  readonly reviewed: string
  readonly authoritative: string
}

export type RevalidationResult =
  | { readonly status: 'unchanged' }
  | { readonly status: 'stale'; readonly changedFields: readonly StaleFieldDiff[] }

export type AuthoritativeRepaymentSnapshot = {
  readonly dealId: string
  readonly repaymentStatus: string | null
  readonly escrowContractAddress: string | null
  readonly investorAddress: string | null
  readonly principal: number
  readonly aprPercent: number
  readonly termDays: number
  readonly investorProfit: number
  readonly investorNetTarget: number
  readonly totalGrossed: number
}

/**
 * Derives the authoritative repayment figures from the deal row exactly the
 * way the admin queue does, so the guard compares like-for-like.
 */
export function buildAuthoritativeSnapshot(
  row: RepaymentQueueDealRow,
): AuthoritativeRepaymentSnapshot {
  const principal = Number(row.amount ?? 0)
  const aprPercent = Number(row.interest_rate ?? 0)
  const termDays = Number(row.term_days ?? 0)
  const { profit, total: investorNetTarget } = computeInvestorReturns(
    principal,
    aprPercent,
    termDays,
  )
  const storedRepayment =
    row.repayment_total_amount != null && Number(row.repayment_total_amount) > 0

  return {
    dealId: row.id,
    repaymentStatus: row.repayment_status ?? null,
    escrowContractAddress: row.escrow_contract_address ?? null,
    investorAddress: row.investor?.address?.trim() ?? null,
    principal,
    aprPercent,
    termDays,
    investorProfit: profit,
    investorNetTarget,
    totalGrossed: storedRepayment
      ? Number(row.repayment_total_amount)
      : repaymentEscrowAmount(principal, profit),
  }
}

/**
 * Compares the reviewed draft against the authoritative snapshot and current
 * configuration. Pure detection — never mutates or rebuilds.
 */
export function compareAuthoritativeSnapshot(
  snapshot: AuthoritativeRepaymentSnapshot,
  draft: RepaymentEscrowDeploymentDraft,
  config: TrustlessConfigSnapshot,
): readonly StaleFieldDiff[] {
  const diffs: StaleFieldDiff[] = []

  if (snapshot.repaymentStatus !== 'order_confirmed') {
    diffs.push({
      field: 'deal.repayment_status',
      reviewed: 'order_confirmed',
      authoritative: snapshot.repaymentStatus ?? '',
    })
  }

  if (snapshot.escrowContractAddress) {
    diffs.push({
      field: 'deal.escrow_contract_address',
      reviewed: '',
      authoritative: snapshot.escrowContractAddress,
    })
  }

  if (snapshot.investorAddress !== draft.sourceInvestor) {
    diffs.push({
      field: 'deal.investor_address',
      reviewed: draft.sourceInvestor,
      authoritative: snapshot.investorAddress ?? '',
    })
  }

  if (snapshot.investorProfit > 0 && snapshot.investorProfit !== draft.repayment.investorProfit) {
    diffs.push({
      field: 'repayment.investor_profit',
      reviewed: String(draft.repayment.investorProfit),
      authoritative: String(snapshot.investorProfit),
    })
  }

  if (snapshot.investorNetTarget > 0 && snapshot.investorNetTarget !== draft.repayment.investorNetTarget) {
    diffs.push({
      field: 'repayment.investor_net_target',
      reviewed: String(draft.repayment.investorNetTarget),
      authoritative: String(snapshot.investorNetTarget),
    })
  }

  if (snapshot.totalGrossed > 0 && snapshot.totalGrossed !== draft.repayment.totalGrossed) {
    diffs.push({
      field: 'repayment.total_grossed',
      reviewed: String(draft.repayment.totalGrossed),
      authoritative: String(snapshot.totalGrossed),
    })
  }

  if (draft.network !== config.network) {
    diffs.push({
      field: 'config.network',
      reviewed: draft.network,
      authoritative: config.network,
    })
  }

  if (draft.roles.platformAddress !== config.platformAddress) {
    diffs.push({
      field: 'config.platform_address',
      reviewed: draft.roles.platformAddress,
      authoritative: config.platformAddress,
    })
  }

  if (draft.trustline.address !== config.trustline.address) {
    diffs.push({
      field: 'config.trustline_address',
      reviewed: draft.trustline.address,
      authoritative: config.trustline.address,
    })
  }

  return diffs
}

/**
 * Re-reads the authoritative deal immediately before signing. Only reports
 * stale state; the caller decides whether to block deployment.
 */
export async function revalidateAuthoritativeState(
  draft: RepaymentEscrowDeploymentDraft,
  dealId: string,
  config: TrustlessConfigSnapshot,
): Promise<RevalidationResult> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deals')
    .select(REPAYMENT_QUEUE_DEAL_SELECT)
    .eq('id', dealId)
    .single()

  if (error) throw error
  if (!data) {
    return { status: 'stale', changedFields: [{ field: 'deal', reviewed: '', authoritative: 'deal not found' }] }
  }

  const snapshot = buildAuthoritativeSnapshot(data as RepaymentQueueDealRow)
  const changedFields = compareAuthoritativeSnapshot(snapshot, draft, config)
  return changedFields.length === 0
    ? { status: 'unchanged' }
    : { status: 'stale', changedFields }
}