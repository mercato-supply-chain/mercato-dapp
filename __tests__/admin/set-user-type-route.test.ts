import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

type RpcCall = { fn: string; args: Record<string, unknown> }

const state = {
  adminOk: true,
  rpcResult: { data: 'audit-role-1', error: null as { code?: string } | null },
  rpcCalls: [] as RpcCall[],
}

mock.module('@/lib/ramp-api', () => ({
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

const { POST } = await import('@/app/api/admin/users/[id]/role/route')

function post(body: unknown, id = 'user-1'): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/admin/users/${id}/role`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

beforeEach(() => {
  state.adminOk = true
  state.rpcResult = { data: 'audit-role-1', error: null }
  state.rpcCalls = []
})

afterEach(() => {
  mock.restore()
})

test('passes the guard response through for non-admins', async () => {
  state.adminOk = false
  const res = await post({ userType: 'admin' })
  expect(res.status).toBe(403)
  expect(state.rpcCalls).toHaveLength(0)
})

test('invokes admin_set_user_type with the exact arguments', async () => {
  const res = await post({ userType: 'admin', reason: 'Ops onboarding' })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true, auditEventId: 'audit-role-1' })
  expect(state.rpcCalls).toEqual([
    {
      fn: 'admin_set_user_type',
      args: {
        p_profile_id: 'user-1',
        p_user_type: 'admin',
        p_reason: 'Ops onboarding',
      },
    },
  ])
})

test('rejects unknown roles without calling the RPC', async () => {
  const res = await post({ userType: 'superadmin' })
  expect(res.status).toBe(400)
  expect(state.rpcCalls).toHaveLength(0)
})

test('maps RPC forbidden and not-found errors to HTTP statuses', async () => {
  state.rpcResult = { data: null, error: { code: '42501' } }
  expect((await post({ userType: 'pyme' })).status).toBe(403)

  state.rpcResult = { data: null, error: { code: 'P0002' } }
  expect((await post({ userType: 'pyme' })).status).toBe(404)
})
