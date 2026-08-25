import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/ramp-api'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Only these public-profile fields can be corrected by an admin. */
const EDITABLE_FIELDS = new Set([
  'full_name',
  'contact_name',
  'company_name',
  'phone',
  'country',
  'sector',
  'website',
  'bio',
])

type UpdateBody = {
  fields?: unknown
  reason?: unknown
}

/**
 * PATCH /api/admin/users/[id] — apply whitelisted public-profile corrections.
 * The admin_update_profile RPC re-validates the whitelist, re-checks the admin
 * role, and writes the audit event atomically.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
  }

  let body: UpdateBody
  try {
    body = (await request.json()) as UpdateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fields, reason } = body
  if (
    fields == null ||
    typeof fields !== 'object' ||
    Array.isArray(fields) ||
    (reason != null && typeof reason !== 'string')
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const entries = Object.entries(fields as Record<string, unknown>).filter(
    ([key, value]) =>
      EDITABLE_FIELDS.has(key) && (typeof value === 'string' || value === null),
  )
  if (entries.length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_update_profile', {
    p_profile_id: id,
    p_fields: Object.fromEntries(entries),
    p_reason: reason ?? null,
  })

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error.code === 'P0002') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[admin:users:update]', error)
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, auditEventId: data })
}
