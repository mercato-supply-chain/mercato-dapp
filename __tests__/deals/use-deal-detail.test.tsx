import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { DealRow } from '@/lib/deals'
import type { Deal } from '@/lib/types'

type DealQueryResult = {
  data: DealRow | null
  error: { code: string; details: string } | null
}

type TestGlobals = typeof globalThis & {
  __dealResponses?: Map<string, Array<Promise<DealQueryResult>>>
  __dealCalls?: string[]
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function dealRow(id: string, productName = `Deal ${id}`): DealRow {
  return {
    id,
    pyme_id: '',
    title: productName,
    description: '',
    category: 'other',
    product_name: productName,
    product_quantity: 1,
    product_unit_price: 10,
    supplier_name: 'Supplier',
    amount: 100,
    interest_rate: 5,
    term_days: 30,
    status: 'seeking_funding',
    milestones: [],
  }
}

function enqueueDealResponse(id: string, response: Promise<DealQueryResult>) {
  const globals = globalThis as TestGlobals
  const queue = globals.__dealResponses?.get(id) ?? []
  globals.__dealResponses?.set(id, [...queue, response])
}

function resolvedDeal(id: string, productName?: string): Promise<DealQueryResult> {
  return Promise.resolve({ data: dealRow(id, productName), error: null })
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

mock.module('@/lib/supabase/client', () => ({
  createClient: () => {
    const globals = globalThis as TestGlobals
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
      from: (table: string) => ({
        select: () => {
          let recordId = ''
          const builder = {
            eq: (_column: string, value: string) => {
              recordId = value
              return builder
            },
            single: async () => {
              if (table === 'profiles') return { data: null, error: null }
              globals.__dealCalls?.push(recordId)
              const response = globals.__dealResponses?.get(recordId)?.shift()
              return response ?? {
                data: null,
                error: { code: 'PGRST116', details: 'The result contains 0 rows' },
              }
            },
          }
          return builder
        },
      }),
    }
  },
}))

mock.module('@/hooks/use-wallet', () => ({
  useWallet: () => ({ walletInfo: null, isConnected: false, handleConnect: () => {} }),
}))

mock.module('@trustless-work/escrow/hooks', () => ({
  useGetEscrowFromIndexerByContractIds: () => ({
    getEscrowByContractIds: async () => [],
  }),
}))

import { useDealDetail } from '@/hooks/use-deal-detail'

const globals = globalThis as TestGlobals

beforeEach(() => {
  globals.__dealResponses = new Map()
  globals.__dealCalls = []
})

afterEach(() => {
  cleanup()
  mock.restore()
  delete globals.__dealResponses
  delete globals.__dealCalls
})

describe('useDealDetail load lifecycle', () => {
  test('keeps B active when A resolves after an ID switch', async () => {
    const requestA = deferred<DealQueryResult>()
    const requestB = deferred<DealQueryResult>()
    enqueueDealResponse('A', requestA.promise)
    enqueueDealResponse('B', requestB.promise)

    const hook = renderHook(({ dealId }) => useDealDetail(dealId), {
      initialProps: { dealId: 'A' as string | undefined },
      wrapper: TestWrapper,
    })
    await waitFor(() => expect(globals.__dealCalls).toEqual(['A']))

    hook.rerender({ dealId: 'B' })
    expect(hook.result.current.isLoading).toBe(true)
    expect(hook.result.current.deal).toBeNull()
    await waitFor(() => expect(globals.__dealCalls).toEqual(['A', 'B']))

    await act(async () => {
      requestB.resolve({ data: dealRow('B'), error: null })
      await requestB.promise
    })
    await waitFor(() => expect(hook.result.current.deal?.id).toBe('B'))

    await act(async () => {
      requestA.resolve({ data: dealRow('A'), error: null })
      await requestA.promise
    })
    expect(hook.result.current.deal?.id).toBe('B')
  })

  test('shows a retryable error after rejection and recovers on retry', async () => {
    const rejectedRequest = deferred<DealQueryResult>()
    enqueueDealResponse('A', rejectedRequest.promise)
    const retryRequest = deferred<DealQueryResult>()
    enqueueDealResponse('A', retryRequest.promise)

    const hook = renderHook(() => useDealDetail('A'), { wrapper: TestWrapper })
    await waitFor(() => expect(globals.__dealCalls).toEqual(['A']))
    await act(async () => {
      rejectedRequest.reject(new Error('network failure'))
      await rejectedRequest.promise.catch(() => {})
    })
    await waitFor(() => expect(hook.result.current.loadError).toBe(true))
    expect(hook.result.current.isLoading).toBe(false)

    act(() => hook.result.current.retry())
    expect(hook.result.current.isLoading).toBe(true)
    await waitFor(() => expect(globals.__dealCalls).toEqual(['A', 'A']))
    await act(async () => {
      retryRequest.resolve({ data: dealRow('A'), error: null })
      await retryRequest.promise
    })
    await waitFor(() => expect(hook.result.current.deal?.id).toBe('A'))
    expect(hook.result.current.loadError).toBe(false)
  })

  test('distinguishes query errors from a missing row', async () => {
    enqueueDealResponse('error', Promise.resolve({
      data: null,
      error: { code: '42501', details: 'permission denied' },
    }))
    enqueueDealResponse('multiple', Promise.resolve({
      data: null,
      error: { code: 'PGRST116', details: 'The result contains 2 rows' },
    }))
    enqueueDealResponse('missing', Promise.resolve({
      data: null,
      error: { code: 'PGRST116', details: 'The result contains 0 rows' },
    }))

    const hook = renderHook(({ dealId }) => useDealDetail(dealId), {
      initialProps: { dealId: 'error' as string | undefined },
      wrapper: TestWrapper,
    })
    await waitFor(() => expect(hook.result.current.loadError).toBe(true))

    hook.rerender({ dealId: 'multiple' })
    await waitFor(() => expect(globals.__dealCalls).toEqual(['error', 'multiple']))
    await waitFor(() => expect(hook.result.current.loadError).toBe(true))

    hook.rerender({ dealId: 'missing' })
    await waitFor(() => expect(globals.__dealCalls).toEqual(['error', 'multiple', 'missing']))
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
    expect(hook.result.current.deal).toBeNull()
    expect(hook.result.current.loadError).toBe(false)
  })

  test('does not request a deal when the ID is missing', () => {
    const hook = renderHook(() => useDealDetail(undefined), { wrapper: TestWrapper })
    expect(hook.result.current.isLoading).toBe(false)
    expect(hook.result.current.deal).toBeNull()
    expect(hook.result.current.loadError).toBe(false)
    expect(globals.__dealCalls).toEqual([])
  })

  test('ignores a pending load after unmount', async () => {
    const pendingRequest = deferred<DealQueryResult>()
    enqueueDealResponse('A', pendingRequest.promise)
    const errors: unknown[][] = []
    const originalConsoleError = console.error
    console.error = (...args) => errors.push(args)

    try {
      const hook = renderHook(() => useDealDetail('A'), { wrapper: TestWrapper })
      await waitFor(() => expect(globals.__dealCalls).toEqual(['A']))
      hook.unmount()
      await act(async () => {
        pendingRequest.resolve({ data: dealRow('A'), error: null })
        await pendingRequest.promise
      })
      expect(errors).toEqual([])
    } finally {
      console.error = originalConsoleError
    }
  })

  test('commits the newer of two overlapping refreshes', async () => {
    enqueueDealResponse('A', resolvedDeal('A', 'Initial'))
    const olderRequest = deferred<DealQueryResult>()
    const newerRequest = deferred<DealQueryResult>()
    enqueueDealResponse('A', olderRequest.promise)
    enqueueDealResponse('A', newerRequest.promise)
    const hook = renderHook(() => useDealDetail('A'), { wrapper: TestWrapper })
    await waitFor(() => expect(hook.result.current.deal?.productName).toBe('Initial'))

    let olderRefresh!: Promise<Deal | null>
    let newerRefresh!: Promise<Deal | null>
    act(() => {
      olderRefresh = hook.result.current.fetchDeal()
      newerRefresh = hook.result.current.fetchDeal()
    })
    await waitFor(() => expect(globals.__dealCalls).toHaveLength(3))

    await act(async () => {
      newerRequest.resolve({ data: dealRow('A', 'Newer'), error: null })
      const updated = await newerRefresh
      if (updated) hook.result.current.setDeal(updated)
    })
    await act(async () => {
      olderRequest.resolve({ data: dealRow('A', 'Older'), error: null })
      const updated = await olderRefresh
      if (updated) hook.result.current.setDeal(updated)
    })

    expect(hook.result.current.deal?.productName).toBe('Newer')
  })

  test('ignores a refresh result from an obsolete route', async () => {
    enqueueDealResponse('A', resolvedDeal('A'))
    const obsoleteRequest = deferred<DealQueryResult>()
    enqueueDealResponse('A', obsoleteRequest.promise)
    enqueueDealResponse('B', resolvedDeal('B'))
    const hook = renderHook(({ dealId }) => useDealDetail(dealId), {
      initialProps: { dealId: 'A' as string | undefined },
      wrapper: TestWrapper,
    })
    await waitFor(() => expect(hook.result.current.deal?.id).toBe('A'))

    let obsoleteRefresh!: Promise<Deal | null>
    act(() => {
      obsoleteRefresh = hook.result.current.fetchDeal()
    })
    await waitFor(() => expect(globals.__dealCalls).toEqual(['A', 'A']))
    hook.rerender({ dealId: 'B' })
    await waitFor(() => expect(hook.result.current.deal?.id).toBe('B'))

    await act(async () => {
      obsoleteRequest.resolve({ data: dealRow('A'), error: null })
      const updated = await obsoleteRefresh
      if (updated) hook.result.current.setDeal(updated)
    })
    expect(hook.result.current.deal?.id).toBe('B')
  })

  test('keeps the return contract and resolves failed refreshes to null', async () => {
    enqueueDealResponse('A', resolvedDeal('A'))
    const failedRefresh = deferred<DealQueryResult>()
    enqueueDealResponse('A', failedRefresh.promise)
    const hook = renderHook(() => useDealDetail('A'), { wrapper: TestWrapper })
    await waitFor(() => expect(hook.result.current.deal?.id).toBe('A'))

    const expectedFields = [
      'deal',
      'setDeal',
      'isLoading',
      'loadError',
      'retry',
      'userId',
      'userType',
      'isSupplier',
      'isPyme',
      'isAdmin',
      'indexerEscrow',
      'pymeReputation',
      'supplierReputation',
      'partyReputationsLoading',
      'fetchDeal',
      'supabase',
      'walletInfo',
      'isConnected',
      'handleConnect',
    ]
    for (const field of expectedFields) {
      expect(hook.result.current).toHaveProperty(field)
    }

    let refresh!: Promise<Deal | null>
    act(() => {
      refresh = hook.result.current.fetchDeal()
    })
    await waitFor(() => expect(globals.__dealCalls).toHaveLength(2))
    await act(async () => {
      failedRefresh.reject(new Error('refresh failed'))
      await expect(refresh).resolves.toBeNull()
    })
  })
})