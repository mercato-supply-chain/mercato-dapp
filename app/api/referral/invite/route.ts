import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isInvitationActive } from '@/lib/referrals/invitation-metrics'
import { hashInviteToken } from '@/lib/referrals/token'
import { logReferralEvent } from '@/lib/referrals/log-event'

export const dynamic = 'force-dynamic'

export type ResolvedInvite = {
  invitationId: string
  supplierCompanyId: string
  companyName: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')?.trim()

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const tokenHash = hashInviteToken(token)

  const { data: invitation, error } = await supabase
    .from('supplier_referral_invitations')
    .select('id, supplier_company_id, status, expires_at, supplier:supplier_companies(company_name)')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (!isInvitationActive(invitation.status, invitation.expires_at)) {
    return NextResponse.json({ error: 'Invitation is no longer active' }, { status: 400 })
  }

  await logReferralEvent(supabase, {
    supplierCompanyId: invitation.supplier_company_id,
    invitationId: invitation.id,
    eventType: 'link_opened',
  })

  const company = invitation.supplier as { company_name?: string | null } | null

  return NextResponse.json({
    invitationId: invitation.id,
    supplierCompanyId: invitation.supplier_company_id,
    companyName: company?.company_name ?? null,
  } satisfies ResolvedInvite)
}
