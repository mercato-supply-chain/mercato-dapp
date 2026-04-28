import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setStakeAmount, StakeValidationError } from '@/lib/stake-signal'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('stake_amount, stake_updated_at')
    .eq('id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    stakeAmount: Number(data?.stake_amount ?? 0),
    stakeUpdatedAt: data?.stake_updated_at ?? null,
    // Stake score contribution is intentionally deferred in v1.
    scoreIntegration: 'deferred',
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as
    | { amount?: unknown }
    | null

  const amount = Number(payload?.amount)

  try {
    // v1 limitation: available-capital ceiling is not enforced until issue #13 is available.
    const stake = await setStakeAmount(supabase, user.id, amount)

    return NextResponse.json({
      stakeAmount: stake.stakeAmount,
      stakeUpdatedAt: stake.stakeUpdatedAt,
      scoreIntegration: 'deferred',
    })
  } catch (error) {
    if (error instanceof StakeValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const message = error instanceof Error ? error.message : 'Failed to set stake amount'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
