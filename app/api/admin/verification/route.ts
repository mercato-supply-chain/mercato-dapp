import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/route-auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ENTITY_TYPES = new Set(['profile', 'supplier_company'])

type VerificationBody = {
  entityType?: unknown
  entityId?: unknown
  verified?: unknown
  reason?: unknown
}

/**
 * POST /api/admin/verification — verify or unverify a profile or supplier
 * company. The admin_set_verification RPC re-checks the admin role and writes
 * the audit event in the same transaction.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: VerificationBody
  try {
    body = (await request.json()) as VerificationBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { entityType, entityId, verified, reason } = body
  if (
    typeof entityType !== 'string' ||
    !ENTITY_TYPES.has(entityType) ||
    typeof entityId !== 'string' ||
    !entityId ||
    typeof verified !== 'boolean' ||
    (reason != null && typeof reason !== 'string')
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_set_verification', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_verified: verified,
    p_reason: reason ?? null,
  })

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error.code === 'P0002') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[admin:verification]', error)
    return NextResponse.json({ error: 'Verification update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, auditEventId: data })
}
