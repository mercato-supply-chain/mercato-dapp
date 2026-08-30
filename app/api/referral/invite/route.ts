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

async function resolveActiveInvite(token: string) {
  const supabase = createServiceClient()
  const tokenHash = hashInviteToken(token)

  const { data: invitation, error } = await supabase
    .from('supplier_referral_invitations')
    .select('id, supplier_company_id, status, expires_at, supplier:supplier_companies(company_name)')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !invitation) {
    return { error: 'Invitation not found' as const, status: 404 as const }
  }

  if (!isInvitationActive(invitation.status, invitation.expires_at)) {
    return { error: 'Invitation is no longer active' as const, status: 400 as const }
  }

  const company = invitation.supplier as { company_name?: string | null } | null

  return {
    supabase,
    invitation,
    resolved: {
      invitationId: invitation.id,
      supplierCompanyId: invitation.supplier_company_id,
      companyName: company?.company_name ?? null,
    } satisfies ResolvedInvite,
  }
}

/** Resolve opaque invite token; records link_opened. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')?.trim()

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const result = await resolveActiveInvite(token)
  if ('error' in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { supabase, invitation, resolved } = result

  await logReferralEvent(supabase, {
    supplierCompanyId: invitation.supplier_company_id,
    invitationId: invitation.id,
    eventType: 'link_opened',
  })

  return NextResponse.json(resolved)
}

/** Record signup_started when the referred user begins account creation. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string
    event?: string
  } | null

  const token = body?.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  if (body?.event && body.event !== 'signup_started') {
    return NextResponse.json({ error: 'Unsupported event' }, { status: 400 })
  }

  const result = await resolveActiveInvite(token)
  if ('error' in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { supabase, invitation } = result

  await logReferralEvent(supabase, {
    supplierCompanyId: invitation.supplier_company_id,
    invitationId: invitation.id,
    eventType: 'signup_started',
  })

  return NextResponse.json({ ok: true })
}
