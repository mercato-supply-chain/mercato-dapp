import { afterAll, describe, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ReactNamespace from 'react'
import * as SupabaseServerNamespace from '@/lib/supabase/server'
import * as SupabaseServiceNamespace from '@/lib/supabase/service'

// Snapshot the real exports before any mock.module() call: module namespace objects are
// live bindings, so by afterAll time they would already reflect the stubs below.
const ReactOriginal = { ...ReactNamespace }
const SupabaseServerOriginal = { ...SupabaseServerNamespace }
const SupabaseServiceOriginal = { ...SupabaseServiceNamespace }

// Captured before the dedup tests replace 'react'. Bun shares one module registry across test
// files, so the stand-in has to be swapped back or every later file that requires React breaks.
const realReact = await import('react')

const ROOT = join(import.meta.dir, '..')

function readDetailPage(route: string): string {
  return readFileSync(join(ROOT, 'app', route, '[id]', 'page.tsx'), 'utf8')
}

describe('public detail loaders wiring', () => {
  const cases = [
    { route: 'deals', symbol: 'getDealSummary', module: '@/lib/deals/detail' },
    { route: 'pymes', symbol: 'getPublicPymeProfile', module: '@/lib/pymes/directory' },
    { route: 'suppliers', symbol: 'getPublicSupplier', module: '@/lib/suppliers/directory' },
    { route: 'investors', symbol: 'getPublicInvestorProfile', module: '@/lib/investors/directory' },
  ]

  for (const { route, symbol, module } of cases) {
    test(`${route}: metadata and page share ${symbol}`, () => {
      const source = readDetailPage(route)
      expect(source).toContain(`import { ${symbol} } from '${module}'`)
      const calls = source.split(`${symbol}(id)`).length - 1
      expect(calls).toBeGreaterThanOrEqual(2)
    })
  }
})

// React cache() does not memoize outside the Next RSC runtime, so tests stand in a keyed memo.
function keyedMemo<T extends (...args: string[]) => Promise<unknown>>(fn: T): T {
  const memo = new Map<string, unknown>()
  return (async (...args: string[]) => {
    const key = JSON.stringify(args)
    if (!memo.has(key)) memo.set(key, await fn(...args))
    return memo.get(key)
  }) as T
}

function stubServerClient(onRead: () => void, row: Record<string, unknown> | null = null) {
  return {
    createClient: async () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              onRead()
              return { data: row, error: null }
            },
          }),
        }),
      }),
    }),
  }
}

describe('cached loader deduplication', () => {
  test('deal loader reads once for repeated calls with the same id', async () => {
    let reads = 0
    mock.module('react', () => ({ cache: keyedMemo }))
    mock.module('@/lib/supabase/server', () => stubServerClient(() => { reads += 1 }))

    const { getDealSummary } = await import('@/lib/deals/detail')
    await getDealSummary('deal-a')
    await getDealSummary('deal-a')
    expect(reads).toBe(1)
    await getDealSummary('deal-b')
    expect(reads).toBe(2)
  })

  test('deal summary carries the mapped terms and relations from the same server row', async () => {
    let reads = 0
    mock.module('@/lib/supabase/server', () => stubServerClient(() => { reads += 1 }, {
      id: 'server-deal',
      title: 'Invoice title',
      product_name: 'Server product',
      description: 'Server terms',
      pyme_id: 'buyer',
      amount: 250,
      interest_rate: 5,
      term_days: 30,
      status: 'seeking_funding',
      pyme: [{ company_name: 'Buyer', stake_amount: 12, address: 'buyer-address' }],
      supplier: { company_name: 'Supplier', owner_id: 'supplier', address: 'supplier-address' },
      milestones: [],
    }))
    const { getDealSummary } = await import('@/lib/deals/detail')
    const metadataRow = await getDealSummary('server-deal')
    const pageRow = await getDealSummary('server-deal')

    expect(reads).toBe(1)
    expect(pageRow).toBe(metadataRow)
    expect(pageRow?.deal.id).toBe(pageRow?.id)
    expect(pageRow?.deal.productName).toBe(pageRow?.product_name ?? undefined)
    expect(pageRow?.deal.description).toBe(pageRow?.description ?? undefined)
    expect(pageRow?.deal.priceUSDC).toBe(250)
    expect(pageRow?.deal.supplierOwnerId).toBe('supplier')
    expect(pageRow?.deal.supplierAddress).toBe('supplier-address')
  })

  test('investor loader reads once for repeated calls with the same id', async () => {
    let reads = 0
    mock.module('react', () => ({ cache: keyedMemo }))
    mock.module('@/lib/supabase/server', () => stubServerClient(() => { reads += 1 }))

    const { getPublicInvestorProfile } = await import('@/lib/investors/directory')
    await getPublicInvestorProfile('inv-a')
    await getPublicInvestorProfile('inv-a')
    expect(reads).toBe(1)
  })

  test('pyme loader reads once for repeated calls with the same id', async () => {
    let reads = 0
    mock.module('react', () => ({ cache: keyedMemo }))
    mock.module('@/lib/supabase/service', () => ({
      createServiceClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                reads += 1
                return { data: null, error: null }
              },
            }),
          }),
        }),
      }),
    }))

    const { getPublicPymeProfile } = await import('@/lib/pymes/directory')
    await getPublicPymeProfile('pyme-a')
    await getPublicPymeProfile('pyme-a')
    expect(reads).toBe(1)
  })
})

afterAll(() => {
  mock.module('react', () => realReact)
})
