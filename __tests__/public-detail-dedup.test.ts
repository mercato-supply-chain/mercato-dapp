import { describe, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

function stubServerClient(onRead: () => void) {
  return {
    createClient: async () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              onRead()
              return { data: null, error: null }
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
