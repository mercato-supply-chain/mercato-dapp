import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processReferralMilestone, type ReferralMilestoneKind } from '@/lib/referrals/milestones'

export const dynamic = 'force-dynamic'

const ALLOWED: ReferralMilestoneKind[] = ['onboarding_completed', 'deal_created', 'deal_funded']

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    milestone?: string
    dealId?: string
  } | null

  const milestone = body?.milestone as ReferralMilestoneKind | undefined

  if (!milestone || !ALLOWED.includes(milestone)) {
    return NextResponse.json({ error: 'Invalid milestone' }, { status: 400 })
  }

  const service = createServiceClient()
  let subjectUserId = user.id

  if (milestone === 'deal_funded' && body?.dealId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('pyme_id, investor_id, status')
      .eq('id', body.dealId)
      .maybeSingle()

    if (!deal?.pyme_id || deal.investor_id !== user.id || deal.status !== 'funded') {
      return NextResponse.json({ error: 'Invalid deal for milestone' }, { status: 403 })
    }
    subjectUserId = deal.pyme_id
  }

  await processReferralMilestone(service, subjectUserId, milestone, body?.dealId ? { deal_id: body.dealId } : {})

  return NextResponse.json({ ok: true })
}
