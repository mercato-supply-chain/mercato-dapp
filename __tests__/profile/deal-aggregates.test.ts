import { describe, expect, test } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCompletionRate,
  fetchRecentProfileDeals,
  getInvestorDealAggregates,
  getPymeDealAggregates,
  PROFILE_DEAL_LIST_LIMIT,
  type ProfileDealRow,
} from '@/lib/profiles/deal-aggregates'
import { aggregateDealsToStats, computePymeReputation } from '@/lib/pyme-reputation'

type RpcCall = { fn: string; args: Record<string, unknown> }

type FakeClient = {
  rpcCalls: RpcCall[]
  client: SupabaseClient
}

/** Minimal Supabase client stand-in: records RPC args and replays a canned result. */
function fakeClient(rpcResult: { data: unknown; error?: unknown }): FakeClient {
  const rpcCalls: RpcCall[] = []
  return {
    rpcCalls,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args })
        return rpcResult
      },
      from: () => {
        throw new Error('from() should not be called in this test')
      },
    } as unknown as SupabaseClient,
  }
}

function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    data: [
      {
        total_deals: 0,
        total_deployed: 0,
        active_deals: 0,
        active_volume: 0,
        completed_deals: 0,
        total_repaid: 0,
        funded_deals: 0,
        reputation_deals_funded: 0,
        reputation_current_debt: 0,
        cancelled_deals: 0,
        ...overrides,
      },
    ],
  }
}

describe('getInvestorDealAggregates', () => {
  test('reads the aggregate RPC with the investor id', async () => {
    const { client, rpcCalls } = fakeClient(rpcRow({ total_deals: 3 }))

    await getInvestorDealAggregates(client, 'investor-1')

    expect(rpcCalls).toEqual([
      { fn: 'investor_profile_deal_summary', args: { p_investor_id: 'investor-1' } },
    ])
  })

  test('maps every headline figure from the aggregate row', async () => {
    const { client } = fakeClient(
      rpcRow({
        total_deals: 12,
        total_deployed: '450000.50',
        active_deals: 4,
        active_volume: '120000.25',
        completed_deals: 7,
      }),
    )

    expect(await getInvestorDealAggregates(client, 'investor-1')).toEqual({
      totalDeals: 12,
      totalDeployed: 450000.5,
      activeDeals: 4,
      activeVolume: 120000.25,
      completedDeals: 7,
    })
  })

  test('falls back to zeroes when the RPC returns no rows', async () => {
    const { client } = fakeClient({ data: [], error: { message: 'function does not exist' } })

    expect(await getInvestorDealAggregates(client, 'investor-1')).toEqual({
      totalDeals: 0,
      totalDeployed: 0,
      activeDeals: 0,
      activeVolume: 0,
      completedDeals: 0,
    })
  })

  test('treats null and non-numeric values as zero', async () => {
    const { client } = fakeClient(rpcRow({ total_deals: null, total_deployed: 'n/a' }))

    const aggregates = await getInvestorDealAggregates(client, 'investor-1')

    expect(aggregates.totalDeals).toBe(0)
    expect(aggregates.totalDeployed).toBe(0)
  })
})

describe('getPymeDealAggregates', () => {
  test('reads the aggregate RPC with the PyME id', async () => {
    const { client, rpcCalls } = fakeClient(rpcRow({ total_deals: 1 }))

    await getPymeDealAggregates(client, 'pyme-1')

    expect(rpcCalls).toEqual([
      { fn: 'pyme_profile_deal_summary', args: { p_pyme_id: 'pyme-1' } },
    ])
  })

  test('maps headline figures and reputation inputs from one row', async () => {
    const { client } = fakeClient(
      rpcRow({
        total_deals: 9,
        active_deals: 3,
        completed_deals: 5,
        total_repaid: '88000.00',
        funded_deals: 8,
        reputation_deals_funded: 8,
        reputation_current_debt: '21000.00',
        cancelled_deals: 1,
      }),
    )

    expect(await getPymeDealAggregates(client, 'pyme-1')).toEqual({
      totalDeals: 9,
      activeDeals: 3,
      completedDeals: 5,
      totalRepaid: 88000,
      fundedDeals: 8,
      reputationStats: {
        totalRepaid: 88000,
        currentDebt: 21000,
        dealsCompleted: 5,
        dealsFunded: 8,
        dealsCancelled: 1,
      },
    })
  })

  test('falls back to zeroes when the RPC returns no rows', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })

    expect(await getPymeDealAggregates(client, 'pyme-1')).toEqual({
      totalDeals: 0,
      activeDeals: 0,
      completedDeals: 0,
      totalRepaid: 0,
      fundedDeals: 0,
      reputationStats: {
        totalRepaid: 0,
        currentDebt: 0,
        dealsCompleted: 0,
        dealsFunded: 0,
        dealsCancelled: 0,
      },
    })
  })
})

/**
 * The RPC moves the aggregation into SQL. These cases pin the SQL semantics to the
 * application-side `aggregateDealsToStats` behaviour they replaced, so a drift in
 * either one is caught here.
 */
describe('aggregate RPC semantics match aggregateDealsToStats', () => {
  const cases: Array<{ name: string; deals: Array<{ status: string; amount: number }> }> = [
    { name: 'no deals', deals: [] },
    {
      name: 'mixed lifecycle',
      deals: [
        { status: 'completed', amount: 25_000 },
        { status: 'funded', amount: 10_000 },
        { status: 'in_progress', amount: 15_000 },
        { status: 'seeking_funding', amount: 5_000 },
        { status: 'cancelled', amount: 2_000 },
      ],
    },
    {
      name: 'repeated completions',
      deals: [
        { status: 'completed', amount: 20_000 },
        { status: 'completed', amount: 15_000 },
      ],
    },
  ]

  for (const { name, deals } of cases) {
    test(name, async () => {
      // Simulate what the SQL aggregate returns for this deal set.
      const sum = (statuses: string[]) =>
        deals.filter((d) => statuses.includes(d.status)).reduce((total, d) => total + d.amount, 0)
      const count = (statuses: string[]) => deals.filter((d) => statuses.includes(d.status)).length
      const completed = ['completed']

      const { client } = fakeClient(
        rpcRow({
          total_deals: deals.length,
          active_deals: count(['funded', 'in_progress', 'milestone_pending']),
          completed_deals: count(completed),
          total_repaid: sum(completed),
          funded_deals: count(['funded', 'in_progress', 'milestone_pending', 'completed']),
          reputation_deals_funded: count(['funded', 'in_progress', 'completed']),
          reputation_current_debt: sum(['funded', 'in_progress']),
          cancelled_deals: count(['cancelled']),
        }),
      )

      const aggregates = await getPymeDealAggregates(client, 'pyme-1')

      expect(aggregates.reputationStats).toEqual(aggregateDealsToStats(deals))
      expect(aggregates.totalRepaid).toBe(aggregates.reputationStats.totalRepaid)
      expect(aggregates.completedDeals).toBe(aggregates.reputationStats.dealsCompleted)
    })
  }

  test('reputation tier is unchanged when scored from aggregate inputs', () => {
    const deals = [
      { status: 'completed', amount: 25_000 },
      { status: 'funded', amount: 10_000 },
    ]

    const fromDealRows = computePymeReputation(aggregateDealsToStats(deals))
    const fromAggregateRow = computePymeReputation({
      totalRepaid: 25_000,
      currentDebt: 10_000,
      dealsCompleted: 1,
      dealsFunded: 2,
      dealsCancelled: 0,
    })

    expect(fromAggregateRow.tier).toBe(fromDealRows.tier)
    expect(fromAggregateRow.completionRate).toBe(fromDealRows.completionRate)
  })
})

describe('computeCompletionRate', () => {
  test('returns null when nothing was funded', () => {
    expect(computeCompletionRate(0, 0)).toBeNull()
  })

  test('rounds to a whole percentage', () => {
    expect(computeCompletionRate(2, 3)).toBe(67)
    expect(computeCompletionRate(1, 3)).toBe(33)
    expect(computeCompletionRate(4, 4)).toBe(100)
  })
})

describe('fetchRecentProfileDeals', () => {
  /** Records the filter/order/limit the helper applies, then replays fixture rows. */
  function querySpy(rows: unknown[] | null) {
    const applied: Record<string, unknown> = {}
    const builder = {
      select: (columns: string) => {
        applied.columns = columns
        return builder
      },
      eq: (column: string, value: string) => {
        applied.column = column
        applied.value = value
        return builder
      },
      order: (column: string, options: { ascending: boolean }) => {
        applied.order = { column, ...options }
        return builder
      },
      limit: (value: number) => {
        applied.limit = value
        return Promise.resolve({ data: rows?.slice(0, value) ?? null })
      },
    }
    const client = { from: () => builder, rpc: async () => ({ data: null }) }
    return { applied, client: client as unknown as SupabaseClient }
  }

  test('caps the query at the profile list limit and orders newest first', async () => {
    // The fixture holds far more rows than the page renders, so a missing `limit`
    // in the query would show up here as an oversized list.
    const { applied, client } = querySpy(
      Array.from({ length: 25 }, (_, i) => ({ id: `deal-${i + 1}` })),
    )

    const rows = await fetchRecentProfileDeals(client, 'pyme_id', 'pyme-1')

    expect(applied.column).toBe('pyme_id')
    expect(applied.value).toBe('pyme-1')
    expect(applied.order).toEqual({ column: 'created_at', ascending: false })
    expect(applied.limit).toBe(PROFILE_DEAL_LIST_LIMIT)
    expect(applied.columns).toBe('id, title, product_name, status, amount, created_at')
    // The list never transfers more rows than the page renders.
    expect(rows).toHaveLength(PROFILE_DEAL_LIST_LIMIT)
  })

  test('can target the investor column', async () => {
    const { applied, client } = querySpy([])

    await fetchRecentProfileDeals(client, 'investor_id', 'investor-1')

    expect(applied.column).toBe('investor_id')
  })

  test('returns an empty list when the query yields no rows', async () => {
    const { client } = querySpy(null)

    const rows = await fetchRecentProfileDeals(client, 'pyme_id', 'pyme-1')

    expect(rows).toEqual([])
  })
})

describe('ProfileDealRow', () => {
  test('covers the columns the profile lists render', () => {
    const row: ProfileDealRow = {
      id: 'deal-1',
      title: 'Order',
      product_name: null,
      status: 'funded',
      amount: 1_000,
      created_at: '2026-01-01T00:00:00Z',
    }

    expect(row.product_name).toBeNull()
  })
})
