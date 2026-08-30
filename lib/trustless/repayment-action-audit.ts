import { createClient } from '@/lib/supabase/client'

/**
 * Exact lifecycle actions the issue must record. Each maps to one append-only
 * insert; submitted and succeeded are always separate rows, never a mutation
 * of the same record.
 */
export const REPAYMENT_ESCROW_ACTION_TYPES = [
  'deployment_reviewed',
  'deployment_submitted',
  'deployment_succeeded',
  'deployment_failed',
  'milestone_update_reviewed',
  'milestone_update_submitted',
  'milestone_update_succeeded',
  'milestone_update_failed',
  'milestone_approval_reviewed',
  'milestone_approved',
  'milestone_approval_failed',
  'milestone_release_reviewed',
  'milestone_released',
  'milestone_release_failed',
] as const

export type RepaymentEscrowActionType = (typeof REPAYMENT_ESCROW_ACTION_TYPES)[number]

/**
 * Append-only audit input. Deliberately excludes every sensitive field:
 * wallet signatures, private keys, API keys and auth tokens are not representable.
 */
export type RepaymentEscrowActionInput = {
  readonly dealId: string
  readonly actionType: RepaymentEscrowActionType
  readonly adminUserId: string | null
  readonly signingWallet: string | null
  readonly contractId: string | null
  readonly generatedPayload: unknown
  readonly reviewedPayload: unknown
  /** Dotted field paths that changed between generated and reviewed. */
  readonly changedFields: readonly string[]
  readonly reviewTimestamp: string | null
  readonly submissionTimestamp: string | null
  readonly completionTimestamp: string | null
  readonly transactionHash: string | null
  readonly failureMessage: string | null
}

type AuditRow = {
  deal_id: string
  action_type: string
  admin_user_id: string | null
  signing_wallet: string | null
  contract_id: string | null
  generated_payload: unknown
  reviewed_payload: unknown
  changed_fields: readonly string[]
  review_timestamp: string | null
  submission_timestamp: string | null
  completion_timestamp: string | null
  transaction_hash: string | null
  failure_message: string | null
}

/**
 * Append-only writer. Never updates an existing row; `deployment_submitted`
 * and `deployment_succeeded` are independent inserts so a failed transaction
 * cannot retroactively produce a success audit record by mutating a shared row.
 */
export async function recordRepaymentEscrowAction(
  action: RepaymentEscrowActionInput,
): Promise<void> {
  const supabase = createClient()
  const row: AuditRow = {
    deal_id: action.dealId,
    action_type: action.actionType,
    admin_user_id: action.adminUserId,
    signing_wallet: action.signingWallet,
    contract_id: action.contractId,
    generated_payload: action.generatedPayload,
    reviewed_payload: action.reviewedPayload,
    changed_fields: action.changedFields,
    review_timestamp: action.reviewTimestamp,
    submission_timestamp: action.submissionTimestamp,
    completion_timestamp: action.completionTimestamp,
    transaction_hash: action.transactionHash,
    failure_message: action.failureMessage,
  }
  const { error } = await supabase.from('repayment_escrow_actions').insert([row])
  if (error) throw error
}