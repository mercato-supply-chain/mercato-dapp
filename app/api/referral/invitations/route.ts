import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertSupplierOwnsCompany } from '@/lib/referrals/owner-scope'
import { generateInviteToken, hashInviteToken, buildInviteSignupUrl } from '@/lib/referrals/token'
import { logReferralEvent } from '@/lib/referrals/log-event'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company')?.trim() || null
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: companies } = await supabase
    .from('supplier_companies')
    .select('id')
    .eq('owner_id', user.id)

  const ownedIds = (companies ?? []).map((c) => c.id)
  if (ownedIds.length === 0) {
    return NextResponse.json({ data: [], total: 0, page, pageSize })
  }

  if (companyId && !ownedIds.includes(companyId)) {
    return NextResponse.json({ error: 'Invalid company filter' }, { status: 403 })
  }

  let query = supabase
    .from('supplier_referral_invitations')
    .select(
      'id, supplier_company_id, label, recipient_email, status, expires_at, converted_profile_id, revoked_at, created_at, updated_at, supplier:supplier_companies(company_name)',
      { count: 'exact' },
    )
    .in('supplier_company_id', companyId ? [companyId] : ownedIds)
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const invitationIds = (data ?? []).map((row) => row.id)
  const openCounts: Record<string, number> = {}

  if (invitationIds.length > 0) {
    const service = createServiceClient()
    const { data: events } = await service
      .from('referral_events')
      .select('invitation_id')
      .in('invitation_id', invitationIds)
      .eq('event_type', 'link_opened')

    for (const ev of events ?? []) {
      if (ev.invitation_id) {
        openCounts[ev.invitation_id] = (openCounts[ev.invitation_id] ?? 0) + 1
      }
    }
  }

  const rows = (data ?? []).map((row) => {
    const supplier = row.supplier as { company_name?: string | null } | null
    return {
      id: row.id,
      supplierCompanyId: row.supplier_company_id,
      companyName: supplier?.company_name ?? null,
      label: row.label,
      recipientEmail: row.recipient_email,
      status: row.status,
      expiresAt: row.expires_at,
      convertedProfileId: row.converted_profile_id,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
      linkOpenCount: openCounts[row.id] ?? 0,
    }
  })

  return NextResponse.json({ data: rows, total: count ?? 0, page, pageSize })
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'supplier') {
    return NextResponse.json({ error: 'Only suppliers can create invitations' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    supplierCompanyId?: string
    label?: string
    recipientEmail?: string
    expiresAt?: string | null
  } | null

  if (!body?.supplierCompanyId) {
    return NextResponse.json({ error: 'supplierCompanyId is required' }, { status: 400 })
  }

  const owns = await assertSupplierOwnsCompany(supabase, user.id, body.supplierCompanyId)
  if (!owns) {
    return NextResponse.json({ error: 'Invalid supplier company' }, { status: 403 })
  }

  const token = generateInviteToken()
  const tokenHash = hashInviteToken(token)
  const origin = new URL(request.url).origin
  const inviteUrl = buildInviteSignupUrl(origin, token)

  const { data: invitation, error } = await supabase
    .from('supplier_referral_invitations')
    .insert({
      supplier_company_id: body.supplierCompanyId,
      created_by: user.id,
      label: body.label?.trim() || null,
      recipient_email: body.recipientEmail?.trim() || null,
      status: 'active',
      token_hash: tokenHash,
      expires_at: body.expiresAt ?? null,
    })
    .select('id')
    .single()

  if (error || !invitation) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create invitation' }, { status: 500 })
  }

  const service = createServiceClient()
  await logReferralEvent(service, {
    supplierCompanyId: body.supplierCompanyId,
    invitationId: invitation.id,
    eventType: 'invitation_created',
    metadata: { label: body.label ?? null },
  })

  return NextResponse.json({ id: invitation.id, inviteUrl })
}
