import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logReferralEvent } from '@/lib/referrals/log-event'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

async function getOwnedInvitation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
) {
  const { data: companies } = await supabase
    .from('supplier_companies')
    .select('id')
    .eq('owner_id', userId)

  const ownedIds = (companies ?? []).map((c) => c.id)
  if (ownedIds.length === 0) return null

  const { data } = await supabase
    .from('supplier_referral_invitations')
    .select('id, supplier_company_id, status')
    .eq('id', id)
    .in('supplier_company_id', ownedIds)
    .maybeSingle()

  return data
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const invitation = await getOwnedInvitation(supabase, user.id, id)
  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (invitation.status === 'converted') {
    return NextResponse.json({ error: 'Cannot revoke a converted invitation' }, { status: 400 })
  }

  if (invitation.status === 'revoked') {
    return NextResponse.json({ ok: true, alreadyRevoked: true })
  }

  const { error } = await supabase
    .from('supplier_referral_invitations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'active')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const service = createServiceClient()
  await logReferralEvent(service, {
    supplierCompanyId: invitation.supplier_company_id,
    invitationId: invitation.id,
    eventType: 'invitation_revoked',
    profileId: user.id,
  })

  return NextResponse.json({ ok: true })
}
