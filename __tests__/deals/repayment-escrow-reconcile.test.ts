import { describe, expect, test } from 'bun:test'
import { syncDealFromIndexer } from '@/lib/deals/repayment-escrow-reconcile'
import { DEFAULT_REPAYMENT_RETRY_POLICY } from '@/lib/deals/repayment-retry'
import type {
  DealRepository,
  IndexerPort,
} from '@/lib/deals/repayment-escrow-types'

function mockDeals(overrides: Partial<DealRepository> = {}): DealRepository & {
  patches: Record<string, unknown>[]
} {
  const patches: Record<string, unknown>[] = []
  return {
    patches,
    getRepaymentDueAt: async () => null,
    getRepaymentTotal: async () => 100,
    updateDeal: async (_id, patch) => {
      patches.push(patch)
    },
    resolveInvestorWallet: async () => 'GINVESTOR',
    ...overrides,
  }
}

describe('syncDealFromIndexer', () => {
  test('retries empty milestones on the configured delay then persists', async () => {
    const waits: number[] = []
    let calls = 0
    const indexer: IndexerPort = {
      getByContractId: async () => {
        calls += 1
        if (calls < 3) return { milestones: [], balance: 0 } as never
        return {
          milestones: [{ description: 'M1', amount: 100, flags: { released: false } }],
          balance: 40,
        } as never
      },
      getBySigner: async () => [],
      getBalance: async () => 40,
    }
    const deals = mockDeals()

    const result = await syncDealFromIndexer(
      indexer,
      deals,
      async (ms) => {
        waits.push(ms)
      },
      DEFAULT_REPAYMENT_RETRY_POLICY,
      'deal-1',
      'C1',
    )

    expect(calls).toBe(3)
    expect(waits).toEqual([2000, 2000])
    expect(result.status).toBe('funding')
    expect(result.balance).toBe(40)
    expect(deals.patches[0]).toMatchObject({
      repayment_status: 'funding',
      escrow_status: 'active',
    })
  })

  test('skips retry when asked and keeps indexer balance fallback', async () => {
    const waits: number[] = []
    const indexer: IndexerPort = {
      getByContractId: async () =>
        ({ milestones: [], balance: 12 } as never),
      getBySigner: async () => [],
      getBalance: async () => {
        throw new Error('balance endpoint down')
      },
    }
    const deals = mockDeals()

    const result = await syncDealFromIndexer(
      indexer,
      deals,
      async (ms) => {
        waits.push(ms)
      },
      DEFAULT_REPAYMENT_RETRY_POLICY,
      'deal-1',
      'C1',
      undefined,
      { retryOnEmptyMilestones: false },
    )

    expect(waits).toEqual([])
    expect(result.status).toBe('escrow_initialized')
    expect(result.balance).toBe(12)
  })

  test('marks the deal completed when every milestone is released', async () => {
    const indexer: IndexerPort = {
      getByContractId: async () =>
        ({
          milestones: [
            { description: 'M1', amount: 100, flags: { released: true } },
          ],
          balance: 0,
        }) as never,
      getBySigner: async () => [],
      getBalance: async () => 0,
    }
    const deals = mockDeals({ getRepaymentTotal: async () => 100 })

    const result = await syncDealFromIndexer(
      indexer,
      deals,
      async () => {},
      DEFAULT_REPAYMENT_RETRY_POLICY,
      'deal-1',
      'C1',
    )

    expect(result.status).toBe('released')
    expect(deals.patches[0]).toMatchObject({
      repayment_status: 'released',
      escrow_status: 'completed',
      status: 'completed',
    })
    expect(typeof deals.patches[0].completed_at).toBe('string')
  })
})
