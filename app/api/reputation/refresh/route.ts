import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateReputation } from '@/lib/reputation'
import { computeReputationScore, getTrustLabel } from '@/lib/reputation-score'

export const dynamic = 'force-dynamic'

/**
 * POST /api/reputation/refresh
 *
 * Computes the reputation score for the authenticated user by aggregating
 * their on-platform activity (deals, capital, repayment) and stake signal,
 * then persists the result to the `reputations` table.
 *
 * Also accepts an optional `?userId=<id>` query parameter when called
 * internally (e.g. after a deal completes) — only admins may use it.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admins may refresh another user's score by passing userId in the body.
  let targetUserId = user.id
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  const bodyText = await request.text()
  if (bodyText) {
    const body = JSON.parse(bodyText) as { userId?: unknown }
    if (body.userId && typeof body.userId === 'string' && body.userId !== user.id) {
      if (callerProfile?.user_type !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      targetUserId = body.userId
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_type, stake_amount')
    .eq('id', targetUserId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const stakeAmount = Number(profile.stake_amount ?? 0)

  // Aggregate deals based on role
  let capitalCommitted = 0
  let dealsCompleted = 0
  let dealsFunded = 0

  if (profile.user_type === 'investor') {
    const { data: investorDeals } = await supabase
      .from('deals')
      .select('status, amount')
      .eq('investor_id', targetUserId)

    for (const d of investorDeals ?? []) {
      const amount = Number(d.amount ?? 0)
      const status = (d.status ?? '').toLowerCase()
      if (['funded', 'in_progress', 'milestone_pending', 'completed', 'released'].includes(status)) {
        capitalCommitted += amount
        dealsFunded += 1
      }
      if (status === 'completed' || status === 'released') {
        dealsCompleted += 1
      }
    }
  } else if (profile.user_type === 'pyme') {
    const { data: pymeDeals } = await supabase
      .from('deals')
      .select('status, amount')
      .eq('pyme_id', targetUserId)

    for (const d of pymeDeals ?? []) {
      const amount = Number(d.amount ?? 0)
      const status = (d.status ?? '').toLowerCase()
      if (['funded', 'in_progress', 'milestone_pending', 'completed', 'released'].includes(status)) {
        capitalCommitted += amount
        dealsFunded += 1
      }
      if (status === 'completed' || status === 'released') {
        dealsCompleted += 1
      }
    }
  }

  const repaymentPerformance = dealsFunded > 0 ? dealsCompleted / dealsFunded : 0

  const breakdown = computeReputationScore({
    capitalCommitted,
    dealsCompleted,
    dealsFunded,
    stakeAmount,
  })

  const trustLabel = getTrustLabel(breakdown.total)

  const { data: updated, error: updateError } = await updateReputation(supabase, targetUserId, {
    capitalCommitted,
    dealsCompleted,
    repaymentPerformance,
    reputationScore: breakdown.total,
    trustLabel,
    stakeAmount,
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    reputation: updated,
    breakdown,
  })
}
