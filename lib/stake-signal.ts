import type { SupabaseClient } from '@supabase/supabase-js'

export class StakeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StakeValidationError'
  }
}

export interface ValidateStakeAmountParams {
  amount: number
  availableCapital?: number | null
}

export interface StakeSignalRecord {
  stakeAmount: number
  stakeUpdatedAt: string | null
}

/**
 * Stake signal v1 validation:
 * - amount must be finite and >= 0
 * - available-capital ceiling is optional and only enforced when provided
 */
export function validateStakeAmount({
  amount,
  availableCapital,
}: ValidateStakeAmountParams): void {
  if (!Number.isFinite(amount)) {
    throw new StakeValidationError('Stake amount must be a finite number')
  }

  if (amount < 0) {
    throw new StakeValidationError('Stake amount must be greater than or equal to 0')
  }

  if (
    availableCapital != null &&
    Number.isFinite(availableCapital) &&
    amount > availableCapital
  ) {
    throw new StakeValidationError('Stake amount cannot exceed available capital')
  }
}

export async function setStakeAmount(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  availableCapital?: number | null
): Promise<StakeSignalRecord> {
  validateStakeAmount({ amount, availableCapital })

  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('profiles')
    .update({
      stake_amount: amount,
      stake_updated_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', userId)
    .select('stake_amount, stake_updated_at')
    .single()

  if (error) {
    throw error
  }

  return {
    stakeAmount: Number(data?.stake_amount ?? 0),
    stakeUpdatedAt: data?.stake_updated_at ?? null,
  }
}
