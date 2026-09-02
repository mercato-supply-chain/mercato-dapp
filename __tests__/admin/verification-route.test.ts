import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

type RpcCall = { fn: string; args: Record<string, unknown> }

const state = {
  adminOk: true,
  rpcResult: { data: 'audit-1', error: null as { code?: string } | null },
  rpcCalls: [] as RpcCall[],
}

mock.module('@/lib/api/route-auth', () => ({
  requireAdmin: async () =>
    state.adminOk
      ? { ok: true, userId: 'admin-1', email: 'admin@mercato.xyz' }
      : {
          ok: false,
          response: Response.json({ error: 'Forbidden' }, { status: 403 }),
        },
}))

mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args })
      return state.rpcResult
    },
  }),
}))

const { POST } = await import('@/app/api/admin/verification/route')

function post(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/admin/verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  state.adminOk = true
  state.rpcResult = { data: 'audit-1', error: null }
  state.rpcCalls = []
})

afterEach(() => {
  mock.restore()
})

test('passes the guard response through for non-admins', async () => {
  state.adminOk = false
  const res = await post({
    entityType: 'profile',
    entityId: 'user-1',
    verified: true,
  })
  expect(res.status).toBe(403)
  expect(state.rpcCalls).toHaveLength(0)
})

test('invokes admin_set_verification with the exact arguments', async () => {
  const res = await post({
    entityType: 'supplier_company',
    entityId: 'company-1',
    verified: true,
    reason: 'Docs reviewed',
  })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true, auditEventId: 'audit-1' })
  expect(state.rpcCalls).toEqual([
    {
      fn: 'admin_set_verification',
      args: {
        p_entity_type: 'supplier_company',
        p_entity_id: 'company-1',
        p_verified: true,
        p_reason: 'Docs reviewed',
      },
    },
  ])
})

test('rejects unknown entity types without calling the RPC', async () => {
  const res = await post({ entityType: 'deal', entityId: 'x', verified: true })
  expect(res.status).toBe(400)
  expect(state.rpcCalls).toHaveLength(0)
})

test('rejects a missing verified flag', async () => {
  const res = await post({ entityType: 'profile', entityId: 'user-1' })
  expect(res.status).toBe(400)
})

test('maps RPC forbidden and not-found errors to HTTP statuses', async () => {
  state.rpcResult = { data: null, error: { code: '42501' } }
  expect(
    (await post({ entityType: 'profile', entityId: 'u', verified: false })).status,
  ).toBe(403)

  state.rpcResult = { data: null, error: { code: 'P0002' } }
  expect(
    (await post({ entityType: 'profile', entityId: 'u', verified: false })).status,
  ).toBe(404)
})
