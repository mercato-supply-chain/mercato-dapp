export interface Reputation {
  userId: string
  score: number | null
  stakeAmount: number | null
  stakeCurrency: string
  trustLabel: string | null
  updatedAt: string | null
}

type SupabaseLike = {
  from: (table: string) => any
}

const REPUTATION_TABLES = [
  'user_reputations',
  'user_reputation',
  'reputation_scores',
  'reputations',
]
const USER_ID_COLUMNS = ['user_id', 'profile_id', 'id']

function asNumber(value: unknown): number | null {
  if (value == null) return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function normalizeReputation(row: Record<string, unknown>, fallbackUserId: string): Reputation {
  return {
    userId: asString(row.user_id) ?? asString(row.profile_id) ?? asString(row.id) ?? fallbackUserId,
    score: asNumber(row.score ?? row.reputation_score),
    stakeAmount: asNumber(
      row.stake_amount ?? row.stakeAmount ?? row.total_stake_amount ?? row.totalStakeAmount ?? row.stake,
    ),
    stakeCurrency:
      asString(row.stake_currency) ?? asString(row.stakeCurrency) ?? asString(row.currency) ?? 'USDC',
    trustLabel:
      asString(row.trust_label) ??
      asString(row.trustLabel) ??
      asString(row.trust_level) ??
      asString(row.trustLevel) ??
      asString(row.tier) ??
      asString(row.label),
    updatedAt: asString(row.updated_at) ?? asString(row.updatedAt),
  }
}

export async function getReputation(
  supabase: SupabaseLike,
  userId: string | null | undefined,
): Promise<Reputation | null> {
  if (!userId) return null

  for (const table of REPUTATION_TABLES) {
    for (const userColumn of USER_ID_COLUMNS) {
      let data: Record<string, unknown> | null = null

      try {
        const result = await supabase
          .from(table)
          .select('*')
          .eq(userColumn, userId)
          .limit(1)
          .maybeSingle()
        data = result.data
      } catch {
        data = null
      }

      if (data) {
        return normalizeReputation(data, userId)
      }
    }
  }

  return null
}
