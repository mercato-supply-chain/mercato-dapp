import { Reputation } from './types'

type SupabaseLike = {
  from: (table: string) => any
}

function asNumber(value: unknown): number {
  if (value == null) return 0
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Normalizes Supabase row data into the shared Reputation interface.
 */
function normalizeReputation(row: Record<string, unknown>, userId: string): Reputation {
  const reputationScore = asNumber(row.reputation_score || row.score)
  return {
    userId: asString(row.user_id) || userId,
    capitalCommitted: asNumber(row.capital_committed),
    dealsCompleted: asNumber(row.deals_completed),
    repaymentPerformance: asNumber(row.repayment_performance),
    reputationScore,
    score: reputationScore, // Backward compatibility
    stakeAmount: asNumber(row.stake_amount),
    stakeCurrency: asString(row.stake_currency) || 'USDC',
    trustLabel: asString(row.trust_label) || '',
    updatedAt: asString(row.updated_at),
  }
}

/**
 * Fetches the reputation record for a given user.
 */
export async function getReputation(
  supabase: SupabaseLike,
  userId: string | null | undefined,
): Promise<Reputation | null> {
  if (!userId) return null

  const { data, error } = await supabase
    .from('reputations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    // Return a default reputation object if not found
    const now = new Date().toISOString()
    return {
      userId,
      capitalCommitted: 0,
      dealsCompleted: 0,
      repaymentPerformance: 0,
      reputationScore: 0,
      score: 0,
      stakeAmount: 0,
      stakeCurrency: 'USDC',
      trustLabel: 'New',
      updatedAt: now,
    }
  }

  return normalizeReputation(data, userId)
}

/**
 * Updates or creates a reputation record for a user.
 */
export async function updateReputation(
  supabase: SupabaseLike,
  userId: string,
  updates: Partial<Omit<Reputation, 'userId' | 'updatedAt'>>,
): Promise<{ data: Reputation | null; error: any }> {
  // Convert camelCase to snake_case for Supabase
  const dbUpdates: Record<string, any> = {}
  if (updates.capitalCommitted !== undefined) dbUpdates.capital_committed = updates.capitalCommitted
  if (updates.dealsCompleted !== undefined) dbUpdates.deals_completed = updates.dealsCompleted
  if (updates.repaymentPerformance !== undefined) dbUpdates.repayment_performance = updates.repaymentPerformance
  if (updates.reputationScore !== undefined) dbUpdates.reputation_score = updates.reputationScore
  if (updates.score !== undefined && updates.reputationScore === undefined) {
    dbUpdates.reputation_score = updates.score
  }
  if (updates.stakeAmount !== undefined) dbUpdates.stake_amount = updates.stakeAmount
  if (updates.stakeCurrency !== undefined) dbUpdates.stake_currency = updates.stakeCurrency
  if (updates.trustLabel !== undefined) dbUpdates.trust_label = updates.trustLabel

  const { data, error } = await supabase
    .from('reputations')
    .upsert({ user_id: userId, ...dbUpdates })
    .select()
    .single()

  return {
    data: data ? normalizeReputation(data, userId) : null,
    error,
  }
}
