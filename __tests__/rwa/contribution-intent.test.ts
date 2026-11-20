import { describe, expect, test } from 'bun:test'
import { Address, Keypair, xdr } from '@stellar/stellar-sdk'
import {
  confirmContributionIntent,
  getContributionStatus,
  prepareContribution,
  submitContribution,
  type RwaActor,
  type RwaDependencies,
} from '@/lib/rwa/contribution-intent'
import { RwaError } from '@/lib/rwa/errors'
import type { RwaRawEvent } from '@/lib/rwa/chain'

const INVESTOR_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'
const ASSET_ROW_ID = '33333333-3333-4333-8333-333333333333'
const ATTEMPT_ID = '44444444-4444-4444-8444-444444444444'
const TX_HASH = 'd'.repeat(64)

function accountAddress(seed: number): string {
  return Keypair.fromRawEd25519Seed(Buffer.alloc(32, seed)).publicKey()
}

const WALLET = accountAddress(1)
const OTHER_WALLET = accountAddress(2)
const POOL = accountAddress(3)
const ASSET_BYTES = Buffer.alloc(32, 9)
const REF_BYTES = Buffer.alloc(32, 8)
const ASSET_ID = ASSET_BYTES.toString('hex')
/** The token has 7 decimals, so 100 USDC is 1_000_000_000 base units. */
const PRINCIPAL_UNITS = 1_000_000_000
const FEE_UNITS = 10_000_000

type Row = Record<string, unknown>

/**
 * Minimal in-memory Supabase stand-in: supports the filter chains the RWA
 * services use and records every RPC call.
 */
function createFakeSupabase(options: {
  tables?: Record<string, Row[]>
  rpcs?: Record<string, (args: Row) => { data?: unknown; error?: unknown }>
}) {
  const tables = options.tables ?? {}
  const rpcs = options.rpcs ?? {}
  const rpcCalls: Array<{ fn: string; args: Row }> = []

  function matches(row: Row, filters: Array<[string, unknown]>): boolean {
    return filters.every(([column, value]) => row[column] === value)
  }

  const client = {
    rpc: async (fn: string, args: Row) => {
      rpcCalls.push({ fn, args })
      const handler = rpcs[fn]
      if (!handler) {
        return { data: null, error: { message: `unknown rpc ${fn}` } }
      }
      return handler(args)
    },
    from: (table: string) => {
      const filters: Array<[string, unknown]> = []
      const rows = () => (tables[table] ?? []).filter((row) => matches(row, filters))

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
          onFulfilled?: (value: { data: Row[]; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({ data: rows(), error: null }).then(onFulfilled, onRejected),
      }
      return builder
    },
  }

  return { client: client as never, tables, rpcCalls }
}

function createFakeChain(options: {
  transaction?: { successful: boolean; ledger: number } | null
  events?: RwaRawEvent[]
  passphrase?: string | null
}) {
  const state = {
    transaction: options.transaction === undefined
      ? { successful: true, ledger: 555 }
      : options.transaction,
    events: options.events ?? [],
    passphrase: options.passphrase === undefined
      ? 'Test SDF Network ; September 2015'
      : options.passphrase,
    eventRequests: [] as Array<{ contractId: string; txHash: string }>,
  }

  const chain = {
    getTransaction: async () => state.transaction,
    getContractEvents: async (contractId: string, txHash: string) => {
      state.eventRequests.push({ contractId, txHash })
      return state.events
    },
    getNetworkPassphrase: async () => state.passphrase,
  }

  return { chain: chain as never, state }
}

function contributionEvent(params: {
  assetId?: Buffer
  positionId?: number
  investor?: string
  nonce?: bigint
  ref?: Buffer
  principal?: bigint
  fee?: bigint
  ownership?: bigint
  id?: string
  txHash?: string
  contractId?: string
}): RwaRawEvent {
  const {
    assetId = ASSET_BYTES,
    positionId = 0,
    investor = WALLET,
    nonce = BigInt(1),
    ref = REF_BYTES,
    principal = BigInt(PRINCIPAL_UNITS),
    fee = BigInt(FEE_UNITS),
    ownership = BigInt(PRINCIPAL_UNITS),
    id = '555-0-0',
    txHash = TX_HASH,
    contractId = POOL,
  } = params

  return {
    id,
    txHash,
    contractId,
    ledger: 555,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    topic: [
      xdr.ScVal.scvSymbol('contrib_v1'),
      xdr.ScVal.scvBytes(assetId),
      xdr.ScVal.scvU32(positionId),
      xdr.ScVal.scvAddress(new Address(investor).toScAddress()),
    ],
    value: xdr.ScVal.scvVec([
      xdr.ScVal.scvU64(nonce),
      xdr.ScVal.scvBytes(ref),
      xdr.ScVal.scvI128(principal),
      xdr.ScVal.scvI128(fee),
      xdr.ScVal.scvI128(ownership),
    ]),
  }
}

const actor: RwaActor = { userId: INVESTOR_ID, email: 'investor@mercato.xyz' }

function buildDeps(options: {
  tables?: Record<string, Row[]>
  rpcs?: Record<string, (args: Row) => { data?: unknown; error?: unknown }>
  chain?: ReturnType<typeof createFakeChain>
}): RwaDependencies & { rpcCalls: Array<{ fn: string; args: Row }> } {
  const supabase = createFakeSupabase(options)
  const chain = options.chain ?? createFakeChain({})
  return {
    supabase: supabase.client,
    chain: chain.chain,
    config: {
      network: 'testnet',
      networkPassphrase: 'Test SDF Network ; September 2015',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      registryContractId: null,
      usdcSacAddress: null,
      enabled: true,
    },
    rpcCalls: supabase.rpcCalls,
  }
}

function assetRow(overrides: Row = {}): Row {
  return {
    id: ASSET_ROW_ID,
    asset_id: ASSET_ID,
    network: 'testnet',
    registry_contract_id: POOL,
    funding_pool_contract_id: POOL,
    token_contract_id: POOL,
    token_decimals: 7,
    target_principal_units: 10_000_000,
    supplier_address: accountAddress(4),
    fee_recipient_address: accountAddress(5),
    excess_recipient_address: accountAddress(6),
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
    ...overrides,
  }
}

function investorProfile(overrides: Row = {}): Row {
  return {
    id: INVESTOR_ID,
    user_type: 'investor',
    address: WALLET,
    stellar_public_key: null,
    ...overrides,
  }
}

function attemptRow(overrides: Row = {}): Row {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    attempt_id: ATTEMPT_ID,
    idempotency_key: 'idem-key-1234',
    asset_row_id: ASSET_ROW_ID,
    network: 'testnet',
    asset_id: ASSET_ID,
    funding_pool_contract_id: POOL,
    investor_id: INVESTOR_ID,
    investor_address: WALLET,
    principal_units: PRINCIPAL_UNITS,
    nonce: 1,
    contribution_ref: REF_BYTES.toString('hex'),
    status: 'submitted',
    tx_hash: TX_HASH,
    receipt_id: null,
    ledger: null,
    reservation_expires_at: new Date(Date.now() + 60_000).toISOString(),
    confirmed_at: null,
    failure_code: null,
    ...overrides,
  }
}

const reserveRpc = (overrides: Row = {}) => () => ({
  data: {
    attempt_id: ATTEMPT_ID,
    status: 'prepared',
    nonce: 1,
    contribution_ref: REF_BYTES.toString('hex'),
    principal_units: PRINCIPAL_UNITS,
    asset_id: ASSET_ID,
    network: 'testnet',
    funding_pool_contract_id: POOL,
    investor_address: WALLET,
    reservation_expires_at: new Date(Date.now() + 900_000).toISOString(),
    replayed: false,
    ...overrides,
  },
  error: null,
})

describe('prepareContribution', () => {
  test('reserves capacity and returns the intended contract call', async () => {
    const deps = buildDeps({
      tables: { rwa_assets: [assetRow()], profiles: [investorProfile()] },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })

    const result = await prepareContribution(deps, actor, {
      assetId: ASSET_ID,
      amount: 100,
      walletAddress: WALLET,
      idempotencyKey: 'idem-key-1234',
    })

    expect(result.attemptId).toBe(ATTEMPT_ID)
    expect(result.nonce).toBe(1)
    expect(result.call).toEqual({
      contractId: POOL,
      functionName: 'contribute',
      args: {
        investor: WALLET,
        principalUnits: String(PRINCIPAL_UNITS),
        nonce: '1',
        contributionRef: REF_BYTES.toString('hex'),
      },
    })

    const reserveCall = deps.rpcCalls.find(
      (call) => call.fn === 'rwa_reserve_contribution',
    )
    expect(reserveCall?.args.p_principal_units).toBe(String(PRINCIPAL_UNITS))
    expect(reserveCall?.args.p_investor_address).toBe(WALLET)
  })

  test('rejects a caller who is not an investor', async () => {
    const deps = buildDeps({
      tables: {
        rwa_assets: [assetRow()],
        profiles: [investorProfile({ user_type: 'pyme' })],
      },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })

    await expect(
      prepareContribution(deps, actor, {
        assetId: ASSET_ID,
        amount: 100,
        walletAddress: WALLET,
        idempotencyKey: 'idem-key-1234',
      }),
    ).rejects.toThrow(RwaError)
    expect(deps.rpcCalls).toHaveLength(0)
  })

  test('rejects a wallet that is not registered on the account', async () => {
    const deps = buildDeps({
      tables: { rwa_assets: [assetRow()], profiles: [investorProfile()] },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })

    await expect(
      prepareContribution(deps, actor, {
        assetId: ASSET_ID,
        amount: 100,
        walletAddress: OTHER_WALLET,
        idempotencyKey: 'idem-key-1234',
      }),
    ).rejects.toThrow(/not registered/)
    expect(deps.rpcCalls).toHaveLength(0)
  })

  test('rejects an account with no registered wallet', async () => {
    const deps = buildDeps({
      tables: {
        rwa_assets: [assetRow()],
        profiles: [investorProfile({ address: null, stellar_public_key: null })],
      },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })

    await expect(
      prepareContribution(deps, actor, {
        assetId: ASSET_ID,
        amount: 100,
        walletAddress: WALLET,
        idempotencyKey: 'idem-key-1234',
      }),
    ).rejects.toThrow(/No Stellar wallet is registered/)
  })

  test('rejects a wallet that is already bound to another position', async () => {
    const deps = buildDeps({
      tables: {
        rwa_assets: [assetRow()],
        profiles: [investorProfile()],
        rwa_positions: [
          {
            network: 'testnet',
            asset_id: ASSET_ID,
            investor_id: INVESTOR_ID,
            investor_address: OTHER_WALLET,
            position_id: 0,
          },
        ],
      },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })

    await expect(
      prepareContribution(deps, actor, {
        assetId: ASSET_ID,
        amount: 100,
        walletAddress: WALLET,
        idempotencyKey: 'idem-key-1234',
      }),
    ).rejects.toThrow(/already bound/)
  })

  test('rejects an asset that is not open', async () => {
    const deps = buildDeps({
      tables: {
        rwa_assets: [assetRow({ lifecycle: 'ready_to_settle' })],
        profiles: [investorProfile()],
      },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })

    await expect(
      prepareContribution(deps, actor, {
        assetId: ASSET_ID,
        amount: 100,
        walletAddress: WALLET,
        idempotencyKey: 'idem-key-1234',
      }),
    ).rejects.toThrow(/not accepting contributions/)
  })

  test('rejects an asset whose deadline has passed', async () => {
    const deps = buildDeps({
      tables: {
        rwa_assets: [
          assetRow({ deadline_at: new Date(Date.now() - 1000).toISOString() }),
        ],
        profiles: [investorProfile()],
      },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })

    await expect(
      prepareContribution(deps, actor, {
        assetId: ASSET_ID,
        amount: 100,
        walletAddress: WALLET,
        idempotencyKey: 'idem-key-1234',
      }),
    ).rejects.toThrow(/deadline/)
  })

  test('rejects an amount with more precision than the token supports', async () => {
    const deps = buildDeps({
      tables: { rwa_assets: [assetRow()], profiles: [investorProfile()] },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })

    await expect(
      prepareContribution(deps, actor, {
        assetId: ASSET_ID,
        amount: 100.12345678,
        walletAddress: WALLET,
        idempotencyKey: 'idem-key-1234',
      }),
    ).rejects.toThrow(/precision/)
  })

  test('rejects an asset that is not denominated in the expected token', async () => {
    const deps = buildDeps({
      tables: { rwa_assets: [assetRow()], profiles: [investorProfile()] },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })
    deps.config = { ...deps.config, usdcSacAddress: accountAddress(9) }

    await expect(
      prepareContribution(deps, actor, {
        assetId: ASSET_ID,
        amount: 100,
        walletAddress: WALLET,
        idempotencyKey: 'idem-key-1234',
      }),
    ).rejects.toThrow(/expected token/)
    expect(deps.rpcCalls).toHaveLength(0)
  })

  test('accepts an asset that matches the pinned token', async () => {
    const deps = buildDeps({
      tables: {
        rwa_assets: [assetRow({ token_contract_id: accountAddress(9) })],
        profiles: [investorProfile()],
      },
      rpcs: { rwa_reserve_contribution: reserveRpc() },
    })
    deps.config = { ...deps.config, usdcSacAddress: accountAddress(9) }

    const result = await prepareContribution(deps, actor, {
      assetId: ASSET_ID,
      amount: 100,
      walletAddress: WALLET,
      idempotencyKey: 'idem-key-1234',
    })

    expect(result.attemptId).toBe(ATTEMPT_ID)
  })

  test('surfaces the remaining capacity on a conflict', async () => {
    const deps = buildDeps({
      tables: { rwa_assets: [assetRow()], profiles: [investorProfile()] },
      rpcs: {
        rwa_reserve_contribution: () => ({
          data: null,
          error: { message: 'insufficient_capacity:4000000' },
        }),
      },
    })

    const error = await prepareContribution(deps, actor, {
      assetId: ASSET_ID,
      amount: 100,
      walletAddress: WALLET,
      idempotencyKey: 'idem-key-1234',
    }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(RwaError)
    expect((error as RwaError).code).toBe('rwa_insufficient_capacity')
    expect((error as RwaError).details.availablePrincipalUnits).toBe(4_000_000)
  })
})

describe('submitContribution', () => {
  test('records the transaction hash without confirming it', async () => {
    const deps = buildDeps({
      tables: { rwa_contributions: [attemptRow({ status: 'prepared' })] },
      rpcs: { rwa_record_submission: () => ({ data: { status: 'submitted' } }) },
    })

    const result = await submitContribution(deps, actor, {
      attemptId: ATTEMPT_ID,
      txHash: TX_HASH,
    })

    expect(result.status).toBe('submitted')
    const call = deps.rpcCalls.find((c) => c.fn === 'rwa_record_submission')
    expect(call?.args.p_tx_hash).toBe(TX_HASH)
  })

  test('refuses to act on another investor\'s attempt', async () => {
    const deps = buildDeps({
      tables: { rwa_contributions: [attemptRow({ investor_id: OTHER_ID })] },
      rpcs: { rwa_record_submission: () => ({ data: { status: 'submitted' } }) },
    })

    await expect(
      submitContribution(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/Unknown contribution attempt/)
    expect(deps.rpcCalls).toHaveLength(0)
  })
})

describe('confirmContributionIntent', () => {
  function depsWithAttempt(overrides: {
    attempt?: Row
    events?: RwaRawEvent[]
    transaction?: { successful: boolean; ledger: number } | null
    passphrase?: string | null
  } = {}) {
    return buildDeps({
      tables: {
        rwa_assets: [assetRow()],
        rwa_contributions: [attemptRow(overrides.attempt ?? {})],
        profiles: [investorProfile()],
        rwa_positions: [],
      },
      rpcs: {
        rwa_confirm_contribution: () => ({
          data: {
            replayed: false,
            target_reached: false,
            receipt_id: `${TX_HASH}:555-0-0`,
            position_id: 0,
            principal_units: PRINCIPAL_UNITS,
            ownership_units: PRINCIPAL_UNITS,
            funding_fee_units: FEE_UNITS,
            contribution_count: 1,
            lifecycle: 'open',
          },
          error: null,
        }),
      },
      chain: createFakeChain({
        events: overrides.events,
        transaction: overrides.transaction,
        passphrase: overrides.passphrase,
      }),
    })
  }

  test('projects a matching contribution event', async () => {
    const deps = depsWithAttempt({ events: [contributionEvent({})] })

    const result = await confirmContributionIntent(deps, actor, {
      attemptId: ATTEMPT_ID,
      txHash: TX_HASH,
    })

    expect(result.status).toBe('confirmed')
    expect(result.countsAsFundedPrincipal).toBe(true)
    expect(result.receiptId).toBe(`${TX_HASH}:555-0-0`)

    const call = deps.rpcCalls.find((c) => c.fn === 'rwa_confirm_contribution')
    expect(call?.args.p_observed_nonce).toBe('1')
    expect(call?.args.p_observed_principal_units).toBe(String(PRINCIPAL_UNITS))
    expect(call?.args.p_observed_position_id).toBe(0)
  })

  test('rejects a transaction that did not succeed', async () => {
    const deps = depsWithAttempt({
      transaction: { successful: false, ledger: 555 },
      events: [contributionEvent({})],
    })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/did not succeed/)
  })

  test('rejects a transaction the network does not know', async () => {
    const deps = depsWithAttempt({ transaction: null })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/not found/)
  })

  test('rejects an unrelated but valid transaction', async () => {
    const deps = depsWithAttempt({ events: [] })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/did not produce a funding contribution event/)
  })

  test('rejects a contribution event with the wrong nonce', async () => {
    const deps = depsWithAttempt({
      events: [contributionEvent({ nonce: BigInt(99) })],
    })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/does not match the reserved intent/)
  })

  test('rejects a contribution event with the wrong principal', async () => {
    const deps = depsWithAttempt({
      events: [contributionEvent({ principal: BigInt(42) })],
    })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/does not match the reserved intent/)
  })

  test('rejects a contribution event from a different investor', async () => {
    const deps = depsWithAttempt({
      events: [contributionEvent({ investor: OTHER_WALLET })],
    })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/does not match the reserved intent/)
  })

  test('rejects a contribution event for a different asset', async () => {
    const deps = depsWithAttempt({
      events: [contributionEvent({ assetId: Buffer.alloc(32, 7) })],
    })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/does not match the reserved intent/)
  })

  test('rejects a contribution event with the wrong reference', async () => {
    const deps = depsWithAttempt({
      events: [contributionEvent({ ref: Buffer.alloc(32, 3) })],
    })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/does not match the reserved intent/)
  })

  test('rejects a chain reader connected to another network', async () => {
    const deps = depsWithAttempt({
      passphrase: 'Public Global Stellar Network ; September 2015',
      events: [contributionEvent({})],
    })

    await expect(
      confirmContributionIntent(deps, actor, { attemptId: ATTEMPT_ID, txHash: TX_HASH }),
    ).rejects.toThrow(/different network/)
  })

  test('rejects a transaction that does not match the submitted hash', async () => {
    const deps = depsWithAttempt({ events: [contributionEvent({})] })

    await expect(
      confirmContributionIntent(deps, actor, {
        attemptId: ATTEMPT_ID,
        txHash: 'e'.repeat(64),
      }),
    ).rejects.toThrow(/does not match the submitted contribution/)
  })

  test('a prepared attempt is not funded principal until it is confirmed', async () => {
    const deps = depsWithAttempt({
      attempt: { status: 'prepared', tx_hash: null },
      events: [contributionEvent({})],
    })

    const result = await confirmContributionIntent(deps, actor, {
      attemptId: ATTEMPT_ID,
      txHash: TX_HASH,
    })

    expect(result.status).toBe('confirmed')
  })
})

describe('getContributionStatus', () => {
  test('reports a submitted attempt as contributing zero', async () => {
    const deps = buildDeps({
      tables: { rwa_contributions: [attemptRow({ status: 'submitted' })] },
    })

    const [status] = await getContributionStatus(deps, actor, {
      attemptId: ATTEMPT_ID,
    })

    expect(status.status).toBe('submitted')
    expect(status.countsAsFundedPrincipal).toBe(false)
  })

  test('reports a confirmed attempt as funded principal', async () => {
    const deps = buildDeps({
      tables: { rwa_contributions: [attemptRow({ status: 'confirmed' })] },
    })

    const [status] = await getContributionStatus(deps, actor, {
      attemptId: ATTEMPT_ID,
    })

    expect(status.countsAsFundedPrincipal).toBe(true)
  })

  test('lists the attempts for an asset', async () => {
    const deps = buildDeps({
      tables: {
        rwa_assets: [assetRow()],
        rwa_contributions: [attemptRow({ status: 'confirmed' })],
      },
    })

    const statuses = await getContributionStatus(deps, actor, { assetId: ASSET_ID })

    expect(statuses).toHaveLength(1)
    expect(statuses[0].assetId).toBe(ASSET_ID)
  })
})
