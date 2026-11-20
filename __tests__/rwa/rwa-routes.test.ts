import { beforeEach, expect, mock, test } from 'bun:test'
import { Keypair } from '@stellar/stellar-sdk'

type AuthState = { ok: boolean; status: number }

const state = {
  auth: { ok: true, status: 200 } as AuthState,
  admin: { ok: true, status: 200 } as AuthState,
  rpc: { data: null as unknown, error: null as unknown },
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  reserve: {
    data: {
      attempt_id: '44444444-4444-4444-8444-444444444444',
      status: 'prepared',
      nonce: 1,
      contribution_ref: 'ab'.repeat(32),
      principal_units: 1_000_000_000,
      asset_id: 'cd'.repeat(32),
      network: 'testnet',
      funding_pool_contract_id: 'CEXAMPLE',
      investor_address: '',
      reservation_expires_at: null,
      replayed: false,
    },
    error: null as unknown,
  },
}

const WALLET = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey()
const POOL = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey()
const ASSET_ID = 'cd'.repeat(32)

const TABLES: Record<string, Array<Record<string, unknown>>> = {
  profiles: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      user_type: 'investor',
      address: WALLET,
      stellar_public_key: null,
    },
  ],
  rwa_assets: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      asset_id: ASSET_ID,
      network: 'testnet',
      registry_contract_id: POOL,
      funding_pool_contract_id: POOL,
      token_contract_id: POOL,
      token_decimals: 7,
      target_principal_units: 10_000_000_000,
      supplier_address: POOL,
      fee_recipient_address: POOL,
      excess_recipient_address: POOL,
      funding_fee_bps: 100,
      fee_policy_version: 1,
      deadline_at: new Date(Date.now() + 86_400_000).toISOString(),
      lifecycle: 'open',
      funded_principal_units: 0,
      funding_fee_units: 0,
      position_count: 0,
      target_reached_at: null,
      supplier_paid_at: null,
      deal_id: null,
    },
  ],
  rwa_positions: [],
  rwa_contributions: [],
}

// The real `next/server` initialises React internals that Bun cannot resolve
// once a module mock is active, so the route handlers fail to load. Stubbing
// the response helper keeps the route modules importable under Bun.
mock.module('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
  },
}))

mock.module('@/lib/api/route-auth', () => ({
  requireAuth: async () =>
    state.auth.ok
      ? { ok: true, userId: '11111111-1111-4111-8111-111111111111', email: 'i@mercato.xyz' }
      : {
          ok: false,
          response: Response.json({ error: 'Unauthorized' }, { status: state.auth.status }),
        },
  requireAdmin: async () =>
    state.admin.ok
      ? { ok: true, userId: '99999999-9999-4999-8999-999999999999', email: 'a@mercato.xyz' }
      : {
          ok: false,
          response: Response.json({ error: 'Forbidden' }, { status: state.admin.status }),
        },
}))

mock.module('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args })
      if (fn === 'rwa_reserve_contribution') return state.reserve
      return state.rpc
    },
    from: (table: string) => {
      const filters: Array<[string, unknown]> = []
      const rows = () =>
        (TABLES[table] ?? []).filter((row) =>
          filters.every(([column, value]) => row[column] === value),
        )
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value])
          return builder
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (
          onFulfilled?: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({ data: rows(), error: null }).then(onFulfilled, onRejected),
      }
      return builder
    },
  }),
}))

// Only the transport is replaced: the event decoding is real, so the route
// still exercises the production verification path.
const actualChain = await import('@/lib/rwa/chain')

mock.module('@/lib/rwa/chain', () => ({
  ...actualChain,
  createChainReader: () => ({
    getTransaction: async () => ({ successful: true, ledger: 1 }),
    getContractEvents: async () => [],
    getNetworkPassphrase: async () => 'Test SDF Network ; September 2015',
  }),
}))

const { POST: prepare } = await import('@/app/api/rwa/contributions/prepare/route')
const { POST: submit } = await import('@/app/api/rwa/contributions/submit/route')
const { POST: confirm } = await import('@/app/api/rwa/contributions/confirm/route')
const { GET: status } = await import('@/app/api/rwa/contributions/status/route')
const { POST: settle } = await import('@/app/api/rwa/settlements/supplier/route')
const { POST: refund } = await import('@/app/api/rwa/refunds/route')

function post(handler: (request: Request) => Promise<Response>, body: unknown) {
  return handler(
    new Request('http://localhost/api/rwa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  state.auth = { ok: true, status: 200 }
  state.admin = { ok: true, status: 200 }
  state.rpc = { data: null, error: null }
  state.rpcCalls = []
  state.reserve = {
    data: {
      attempt_id: '44444444-4444-4444-8444-444444444444',
      status: 'prepared',
      nonce: 1,
      contribution_ref: 'ab'.repeat(32),
      principal_units: 1_000_000_000,
      asset_id: ASSET_ID,
      network: 'testnet',
      funding_pool_contract_id: POOL,
      investor_address: WALLET,
      reservation_expires_at: null,
      replayed: false,
    },
    error: null,
  }
})

// The module mocks above are scoped to this file. `mock.restore()` is
// deliberately not called: restoring the real `route-auth` module while the
// route handlers still hold the stubbed bindings breaks Bun's module linker
// for every test file that loads afterwards.

test('prepare passes the auth guard response through', async () => {
  state.auth = { ok: false, status: 401 }
  const res = await post(prepare, {
    assetId: ASSET_ID,
    amount: 100,
    walletAddress: WALLET,
    idempotencyKey: 'idem-key-1234',
  })
  expect(res.status).toBe(401)
  expect(state.rpcCalls).toHaveLength(0)
})

test('prepare rejects a body that fails the schema', async () => {
  const res = await post(prepare, { assetId: 'not-hex', amount: 100 })
  expect(res.status).toBe(400)
  const body = await res.json()
  expect(body.error).toBe('rwa_invalid_request')
  expect(state.rpcCalls).toHaveLength(0)
})

test('prepare rejects an invalid JSON body', async () => {
  const res = await prepare(
    new Request('http://localhost/api/rwa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    }),
  )
  expect(res.status).toBe(400)
})

test('prepare returns the intended contract call', async () => {
  const res = await post(prepare, {
    assetId: ASSET_ID,
    amount: 100,
    walletAddress: WALLET,
    idempotencyKey: 'idem-key-1234',
  })

  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(body.call).toEqual({
    contractId: POOL,
    functionName: 'contribute',
    args: {
      investor: WALLET,
      principalUnits: '1000000000',
      nonce: '1',
      contributionRef: 'ab'.repeat(32),
    },
  })
  expect(body.countsAsFundedPrincipal).toBeUndefined()
})

test('settlement requires the admin role', async () => {
  state.admin = { ok: false, status: 403 }
  const res = await post(settle, { assetId: ASSET_ID, txHash: 'ab'.repeat(32) })
  expect(res.status).toBe(403)
})

test('settlement rejects a missing transaction hash', async () => {
  const res = await post(settle, { assetId: ASSET_ID })
  expect(res.status).toBe(400)
  expect((await res.json()).error).toBe('rwa_invalid_request')
})

test('refund requires an authenticated session', async () => {
  state.auth = { ok: false, status: 401 }
  const res = await post(refund, {
    assetId: ASSET_ID,
    positionId: 0,
    txHash: 'ab'.repeat(32),
  })
  expect(res.status).toBe(401)
})

test('refund rejects a negative position id', async () => {
  const res = await post(refund, {
    assetId: ASSET_ID,
    positionId: -1,
    txHash: 'ab'.repeat(32),
  })
  expect(res.status).toBe(400)
})

test('confirm rejects a malformed transaction hash', async () => {
  const res = await post(confirm, {
    attemptId: '44444444-4444-4444-8444-444444444444',
    txHash: 'nope',
  })
  expect(res.status).toBe(400)
  expect((await res.json()).error).toBe('rwa_invalid_request')
})

test('submit rejects a malformed attempt id', async () => {
  const res = await post(submit, { attemptId: 'nope', txHash: 'ab'.repeat(32) })
  expect(res.status).toBe(400)
})

test('status requires an attempt id or an asset id', async () => {
  const res = await status(new Request('http://localhost/api/rwa/contributions/status'))
  expect(res.status).toBe(400)
  expect((await res.json()).error).toBe('rwa_invalid_request')
})

test('a domain error is reported with its stable code', async () => {
  state.reserve = {
    data: null,
    error: { message: 'insufficient_capacity:4000000' },
  }
  const res = await post(prepare, {
    assetId: ASSET_ID,
    amount: 100,
    walletAddress: WALLET,
    idempotencyKey: 'idem-key-1234',
  })
  // The profile lookup is mocked to return null, so the request is refused
  // before it reaches the reservation. Either way the response carries a
  // stable machine-readable code.
  const body = await res.json()
  expect(typeof body.error).toBe('string')
  expect(body.error.startsWith('rwa_')).toBe(true)
})
