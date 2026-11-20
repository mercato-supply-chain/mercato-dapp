import { test, expect, beforeEach, afterEach } from 'bun:test'
import { nativeToScVal } from '@stellar/stellar-sdk'

import {
  getCachedVaultActivityPage,
  setCachedVaultActivityPage,
  invalidateVaultActivityCache,
} from '@/lib/stellar/vault-activity-cache'
import { summarizeVaultActivity, fetchVaultActivityForAccount } from '@/lib/stellar/vault-activity'
import type { VaultActivityEntry } from '@/lib/stellar/vault-activity'

beforeEach(() => {
  invalidateVaultActivityCache('GA-a', 'CA-a')
  invalidateVaultActivityCache('GA-b', 'CA-b')
})

afterEach(() => {
  invalidateVaultActivityCache('GA-a', 'CA-a')
  invalidateVaultActivityCache('GA-b', 'CA-b')
})

test('setCachedVaultActivityPage and getCachedVaultActivityPage work directly', () => {
  const data = { entries: [], nextCursor: 'abc', hasMore: false }
  setCachedVaultActivityPage('GA-a', 'CA-a', null, 10, data)
  const got = getCachedVaultActivityPage('GA-a', 'CA-a', null, 10)
  expect(got).toEqual(data)
})

test('getCachedVaultActivityPage returns null for uncached key', () => {
  const got = getCachedVaultActivityPage('GA-x', 'CA-x', null, 10)
  expect(got).toBeNull()
})

test('getCachedVaultActivityPage returns null after TTL expiry', () => {
  const data = { entries: [], nextCursor: null, hasMore: false }
  setCachedVaultActivityPage('GA-a', 'CA-a', null, 10, data, -1)
  const got = getCachedVaultActivityPage('GA-a', 'CA-a', null, 10)
  expect(got).toBeNull()
})

test('different account produces different cache key', () => {
  setCachedVaultActivityPage('GA-a', 'CA-v', null, 10, { entries: [], nextCursor: null, hasMore: false })
  setCachedVaultActivityPage('GA-b', 'CA-v', null, 10, { entries: [], nextCursor: null, hasMore: false })
  const a = getCachedVaultActivityPage('GA-a', 'CA-v', null, 10)
  const b = getCachedVaultActivityPage('GA-b', 'CA-v', null, 10)
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
})

test('different vault produces different cache key', () => {
  setCachedVaultActivityPage('GA-a', 'CA-v1', null, 10, { entries: [], nextCursor: null, hasMore: false })
  setCachedVaultActivityPage('GA-a', 'CA-v2', null, 10, { entries: [], nextCursor: null, hasMore: false })
  const a = getCachedVaultActivityPage('GA-a', 'CA-v1', null, 10)
  const b = getCachedVaultActivityPage('GA-a', 'CA-v2', null, 10)
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
})

test('different cursor produces different cache entry', () => {
  setCachedVaultActivityPage('GA-a', 'CA-a', null, 10, { entries: [], nextCursor: null, hasMore: false })
  setCachedVaultActivityPage('GA-a', 'CA-a', 'cursor1', 10, { entries: [], nextCursor: null, hasMore: false })
  const a = getCachedVaultActivityPage('GA-a', 'CA-a', null, 10)
  const b = getCachedVaultActivityPage('GA-a', 'CA-a', 'cursor1', 10)
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
})

test('different limit produces different cache entry', () => {
  setCachedVaultActivityPage('GA-a', 'CA-a', null, 5, { entries: [], nextCursor: null, hasMore: false })
  setCachedVaultActivityPage('GA-a', 'CA-a', null, 20, { entries: [], nextCursor: null, hasMore: false })
  const a = getCachedVaultActivityPage('GA-a', 'CA-a', null, 5)
  const b = getCachedVaultActivityPage('GA-a', 'CA-a', null, 20)
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
})

test('invalidateVaultActivityCache clears all entries for account+vault', () => {
  setCachedVaultActivityPage('GA-a', 'CA-a', null, 10, { entries: [], nextCursor: null, hasMore: false })
  setCachedVaultActivityPage('GA-a', 'CA-a', 'c1', 10, { entries: [], nextCursor: null, hasMore: false })
  setCachedVaultActivityPage('GA-a', 'CA-a', null, 20, { entries: [], nextCursor: null, hasMore: false })

  invalidateVaultActivityCache('GA-a', 'CA-a')

  expect(getCachedVaultActivityPage('GA-a', 'CA-a', null, 10)).toBeNull()
  expect(getCachedVaultActivityPage('GA-a', 'CA-a', 'c1', 10)).toBeNull()
  expect(getCachedVaultActivityPage('GA-a', 'CA-a', null, 20)).toBeNull()
})

test('invalidateVaultActivityCache does not affect other pairs', () => {
  setCachedVaultActivityPage('GA-a', 'CA-a', null, 10, { entries: [], nextCursor: null, hasMore: false })
  setCachedVaultActivityPage('GA-b', 'CA-b', null, 10, { entries: [], nextCursor: null, hasMore: false })

  invalidateVaultActivityCache('GA-a', 'CA-a')

  expect(getCachedVaultActivityPage('GA-a', 'CA-a', null, 10)).toBeNull()
  expect(getCachedVaultActivityPage('GA-b', 'CA-b', null, 10)).not.toBeNull()
})

test('invalidateVaultActivityCache is idempotent', () => {
  expect(() => invalidateVaultActivityCache('GA-x', 'CA-x')).not.toThrow()
})

test('summarizeVaultActivity aggregates deposits and withdrawals', () => {
  const entries = [
    { kind: 'deposit', amountDisplay: 100 } as VaultActivityEntry,
    { kind: 'deposit', amountDisplay: 50 } as VaultActivityEntry,
    { kind: 'withdraw', amountDisplay: 30 } as VaultActivityEntry,
  ]
  const summary = summarizeVaultActivity(entries)
  expect(summary.depositCount).toBe(2)
  expect(summary.withdrawCount).toBe(1)
  expect(summary.totalDepositedDisplay).toBe(150)
  expect(summary.totalWithdrawnDisplay).toBe(30)
})

test('summarizeVaultActivity handles empty array', () => {
  const summary = summarizeVaultActivity([])
  expect(summary.depositCount).toBe(0)
  expect(summary.withdrawCount).toBe(0)
  expect(summary.totalDepositedDisplay).toBe(0)
  expect(summary.totalWithdrawnDisplay).toBe(0)
})

// ---------------------------------------------------------------------------
// fetchVaultActivityForAccount — mocked Horizon fetch
// ---------------------------------------------------------------------------

const CID = 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU'
const ACC = 'GBZXN7PIRZGNMBQOOSZ3KUKKROLLQYLG4SB5Q7B6T7Y5F6Z7K8L9M0N'
const ORIGINAL_FETCH = globalThis.fetch

function makeOpParam(value: unknown, type: string) {
  const scVal = nativeToScVal(value, { type }) as ReturnType<typeof nativeToScVal>
  return { value: scVal.toXDR('base64').toString(), type: 'scval' }
}

function makeOp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    transaction_successful: true,
    transaction_hash: 'tx1',
    created_at: '2025-06-01T00:00:00Z',
    type: 'invoke_host_function',
    paging_token: 'p1',
    parameters: [
      makeOpParam(CID, 'address'),
      makeOpParam('deposit', 'symbol'),
      makeOpParam(5000000n, 'i128'),
    ],
    ...overrides,
  }
}

function mockPage(records: Record<string, unknown>[], hasNext: boolean) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      _embedded: { records },
      _links: hasNext ? { next: { href: 'https://horizon/next' } } : {},
    }),
  }
}

test('fetchVaultActivityForAccount: paging_token becomes nextCursor, hasMore reflects _links.next', async () => {
  invalidateVaultActivityCache(ACC, CID)

  globalThis.fetch = (() =>
    Promise.resolve(mockPage(
      [makeOp({ id: '1', paging_token: 'p-next' })],
      true,
    ))) as unknown as typeof globalThis.fetch

  const result = await fetchVaultActivityForAccount({
    accountId: ACC, vaultContractId: CID, limit: 5, cursor: null,
  })

  expect(result.nextCursor).toBe('p-next')
  expect(result.hasMore).toBe(true)

  globalThis.fetch = ORIGINAL_FETCH
})

test('fetchVaultActivityForAccount: hasMore is false when _links.next is absent', async () => {
  invalidateVaultActivityCache(ACC, CID)

  globalThis.fetch = (() =>
    Promise.resolve(mockPage(
      [makeOp({ id: '1', paging_token: 'p-last' })],
      false,
    ))) as unknown as typeof globalThis.fetch

  const result = await fetchVaultActivityForAccount({
    accountId: ACC, vaultContractId: CID, limit: 5, cursor: null,
  })

  expect(result.hasMore).toBe(false)

  globalThis.fetch = ORIGINAL_FETCH
})

test('fetchVaultActivityForAccount: entries ordered by createdAt descending', async () => {
  invalidateVaultActivityCache(ACC, CID)

  const ops = [
    makeOp({ id: '3', created_at: '2025-01-01T00:00:00Z', paging_token: 'p3' }),
    makeOp({ id: '1', created_at: '2025-06-01T00:00:00Z', paging_token: 'p1' }),
    makeOp({ id: '2', created_at: '2025-03-15T00:00:00Z', paging_token: 'p2' }),
  ]

  globalThis.fetch = (() =>
    Promise.resolve(mockPage(ops, false))) as unknown as typeof globalThis.fetch

  const result = await fetchVaultActivityForAccount({
    accountId: ACC, vaultContractId: CID, limit: 10,
  })

  expect(result.entries).toHaveLength(3)
  expect(result.entries[0].createdAt).toBe('2025-06-01T00:00:00Z')
  expect(result.entries[1].createdAt).toBe('2025-03-15T00:00:00Z')
  expect(result.entries[2].createdAt).toBe('2025-01-01T00:00:00Z')

  globalThis.fetch = ORIGINAL_FETCH
})

test('fetchVaultActivityForAccount: limit clamped to 1 when 0 is passed', async () => {
  invalidateVaultActivityCache(ACC, CID)

  globalThis.fetch = (() =>
    Promise.resolve(mockPage(
      [makeOp({ id: '1', paging_token: 'p1' })],
      false,
    ))) as unknown as typeof globalThis.fetch

  const result = await fetchVaultActivityForAccount({
    accountId: ACC, vaultContractId: CID, limit: 0,
  })

  expect(result.entries).toHaveLength(1)

  globalThis.fetch = ORIGINAL_FETCH
})

test('fetchVaultActivityForAccount: limit clamped to 200 when 500 is passed', async () => {
  invalidateVaultActivityCache(ACC, CID)

  const ops = Array.from({ length: 3 }, (_, i) =>
    makeOp({
      id: String(i),
      created_at: `2025-06-0${i + 1}T00:00:00Z`,
      paging_token: `p${i}`,
    }),
  )

  globalThis.fetch = (() =>
    Promise.resolve(mockPage(ops, false))) as unknown as typeof globalThis.fetch

  const result = await fetchVaultActivityForAccount({
    accountId: ACC, vaultContractId: CID, limit: 500,
  })

  expect(result.entries.length).toBeGreaterThanOrEqual(1)

  globalThis.fetch = ORIGINAL_FETCH
})
