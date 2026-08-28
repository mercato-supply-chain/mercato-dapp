import { describe, expect, test } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AUDIT_ACTIONS, getAdminAuditEvents } from '@/lib/admin/admin-audit'

type QueryLog = {
  filters: [string, ...unknown[]][]
  range: [number, number] | null
}

function chainableQuery(log: QueryLog, result: unknown) {
  const chain = {
    eq: (...args: unknown[]) => {
      log.filters.push(['eq', ...args])
      return chain
    },
    gte: (...args: unknown[]) => {
      log.filters.push(['gte', ...args])
      return chain
    },
    lte: (...args: unknown[]) => {
      log.filters.push(['lte', ...args])
      return chain
    },
    order: () => chain,
    range: (from: number, to: number) => {
      log.range = [from, to]
      return Promise.resolve(result)
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  }
  return chain
}

function mockSupabase(log: QueryLog, rows: unknown[], count: number) {
  return {
    from: (table: string) => ({
      select: () =>
        table === 'admin_audit_events'
          ? chainableQuery(log, { data: rows, count, error: null })
          : chainableQuery(log, { data: [], count: 0, error: null }),
    }),
  } as unknown as SupabaseClient
}

const sampleRow = {
  id: 'evt-1',
  admin_user_id: 'admin-1',
  action: 'verify',
  entity_type: 'profile',
  entity_id: 'user-9',
  before: { verified: false },
  after: { verified: true },
  reason: null,
  created_at: '2026-08-20T10:00:00Z',
  admin: { full_name: 'Ada Admin', contact_name: null, email: 'ada@x.com' },
}

describe('AUDIT_ACTIONS', () => {
  test('covers the actions written by the mutation RPCs', () => {
    expect([...AUDIT_ACTIONS]).toEqual([
      'verify',
      'unverify',
      'update_profile',
      'set_user_type',
    ])
  })
})

describe('getAdminAuditEvents', () => {
  test('maps rows and totals', async () => {
    const log: QueryLog = { filters: [], range: null }
    const result = await getAdminAuditEvents(mockSupabase(log, [sampleRow], 1))
    expect(result.total).toBe(1)
    expect(result.rows[0]).toMatchObject({
      id: 'evt-1',
      adminName: 'Ada Admin',
      action: 'verify',
      entityType: 'profile',
      entityId: 'user-9',
      before: { verified: false },
      after: { verified: true },
    })
  })

  test('applies filters and pagination range', async () => {
    const log: QueryLog = { filters: [], range: null }
    await getAdminAuditEvents(mockSupabase(log, [], 0), {
      adminId: 'admin-1',
      action: 'unverify',
      entityType: 'supplier_company',
      from: '2026-08-01T00:00:00Z',
      to: '2026-08-31T23:59:59Z',
      page: 3,
      pageSize: 10,
    })
    expect(log.filters).toContainEqual(['eq', 'admin_user_id', 'admin-1'])
    expect(log.filters).toContainEqual(['eq', 'action', 'unverify'])
    expect(log.filters).toContainEqual(['eq', 'entity_type', 'supplier_company'])
    expect(log.filters).toContainEqual(['gte', 'created_at', '2026-08-01T00:00:00Z'])
    expect(log.filters).toContainEqual(['lte', 'created_at', '2026-08-31T23:59:59Z'])
    expect(log.range).toEqual([20, 29])
  })

  test('clamps page below 1 and falls back to defaults', async () => {
    const log: QueryLog = { filters: [], range: null }
    const result = await getAdminAuditEvents(mockSupabase(log, [], 0), { page: 0 })
    expect(result.page).toBe(1)
    expect(log.range).toEqual([0, 24])
  })
})
