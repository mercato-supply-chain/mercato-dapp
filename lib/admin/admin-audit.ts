import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminAuditEvent, AdminAuditFilters, AdminAuditResult } from './types'

/** Actions written by the admin mutation RPCs. Single source for filters/labels. */
export const AUDIT_ACTIONS = [
  'verify',
  'unverify',
  'update_profile',
  'set_user_type',
] as const

export const AUDIT_PAGE_SIZE = 25

type AuditRow = {
  id: string
  admin_user_id: string
  action: string
  entity_type: string
  entity_id: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  created_at: string
  admin: {
    full_name?: string | null
    contact_name?: string | null
    email?: string | null
  } | null
}

function mapRow(row: AuditRow): AdminAuditEvent {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    adminName:
      row.admin?.full_name || row.admin?.contact_name || row.admin?.email || null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row.before,
    after: row.after,
    reason: row.reason,
    createdAt: row.created_at,
  }
}

/** Reads the append-only audit trail (RLS limits it to admins). */
export async function getAdminAuditEvents(
  supabase: SupabaseClient,
  filters: Partial<AdminAuditFilters> = {},
): Promise<AdminAuditResult> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = filters.pageSize ?? AUDIT_PAGE_SIZE
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('admin_audit_events')
    .select(
      `id, admin_user_id, action, entity_type, entity_id, before, after, reason, created_at,
      admin:profiles!admin_audit_events_admin_user_id_fkey(full_name, contact_name, email)`,
      { count: 'exact' },
    )

  if (filters.adminId) query = query.eq('admin_user_id', filters.adminId)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.entityIds?.length) query = query.in('entity_id', filters.entityIds)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to)

  const [{ data, count, error }, adminsRes] = await Promise.all([
    query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1),
    supabase
      .from('profiles')
      .select('id, full_name, contact_name, email')
      .eq('user_type', 'admin')
      .order('full_name', { ascending: true }),
  ])

  if (error) {
    return { rows: [], total: 0, page, pageSize, admins: [] }
  }

  const admins = (
    (adminsRes.data ?? []) as {
      id: string
      full_name?: string | null
      contact_name?: string | null
      email?: string | null
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.full_name || row.contact_name || row.email || row.id,
  }))

  return {
    rows: ((data ?? []) as unknown as AuditRow[]).map(mapRow),
    total: count ?? 0,
    page,
    pageSize,
    admins,
  }
}
