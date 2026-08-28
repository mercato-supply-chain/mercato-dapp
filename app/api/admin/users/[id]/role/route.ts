import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/ramp-api'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const USER_TYPES = new Set(['pyme', 'investor', 'supplier', 'admin'])

type RoleBody = {
  userType?: unknown
  reason?: unknown
}

/**
 * POST /api/admin/users/[id]/role — assign a profile role.
 * Signup metadata cannot grant admin; this RPC re-checks the caller is admin
 * and writes the audit event in the same transaction.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
  }

  let body: RoleBody
  try {
    body = (await request.json()) as RoleBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userType, reason } = body
  if (
    typeof userType !== 'string' ||
    !USER_TYPES.has(userType) ||
    (reason != null && typeof reason !== 'string')
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_set_user_type', {
    p_profile_id: id,
    p_user_type: userType,
    p_reason: reason ?? null,
  })

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error.code === 'P0002') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[admin:users:role]', error)
    return NextResponse.json({ error: 'Role update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, auditEventId: data })
}
