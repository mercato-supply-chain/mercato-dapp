import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateInviteToken, hashInviteToken, buildInviteSignupUrl } from '@/lib/referrals/token'
import { logReferralEvent } from '@/lib/referrals/log-event'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: companies } = await supabase
    .from('supplier_companies')
    .select('id')
    .eq('owner_id', user.id)

  const ownedIds = (companies ?? []).map((c) => c.id)

  const { data: existing } = await supabase
    .from('supplier_referral_invitations')
    .select('id, supplier_company_id, label, recipient_email, status')
    .eq('id', id)
    .in('supplier_company_id', ownedIds)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (existing.status === 'converted') {
    return NextResponse.json({ error: 'Cannot regenerate a converted invitation' }, { status: 400 })
  }

  const { data: revoked, error: revokeError } = await supabase
    .from('supplier_referral_invitations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['active', 'expired'])
    .select('id')
    .maybeSingle()

  if (revokeError) {
    return NextResponse.json({ error: 'Failed to regenerate invitation' }, { status: 500 })
  }

  if (!revoked && existing.status === 'active') {
    return NextResponse.json({ error: 'Failed to regenerate invitation' }, { status: 409 })
  }

  let service: ReturnType<typeof createServiceClient> | null = null
  try {
    service = createServiceClient()
  } catch (err) {
    console.error('[referral] service client unavailable for regenerate events', err)
  }

  if (revoked && service) {
    await logReferralEvent(service, {
      supplierCompanyId: existing.supplier_company_id,
      invitationId: id,
      eventType: 'invitation_revoked',
      profileId: user.id,
      metadata: { reason: 'regenerated' },
    })
  }

  const token = generateInviteToken()
  const tokenHash = hashInviteToken(token)
  const origin = new URL(request.url).origin
  const inviteUrl = buildInviteSignupUrl(origin, token)

  const { data: invitation, error } = await supabase
    .from('supplier_referral_invitations')
    .insert({
      supplier_company_id: existing.supplier_company_id,
      created_by: user.id,
      label: existing.label,
      recipient_email: existing.recipient_email,
      status: 'active',
      token_hash: tokenHash,
    })
    .select('id')
    .single()

  if (error || !invitation) {
    return NextResponse.json({ error: 'Failed to regenerate invitation' }, { status: 500 })
  }

  if (service) {
    await logReferralEvent(service, {
      supplierCompanyId: existing.supplier_company_id,
      invitationId: invitation.id,
      eventType: 'invitation_created',
      metadata: { regeneratedFrom: id },
    })
  }

  return NextResponse.json({ id: invitation.id, inviteUrl })
}
