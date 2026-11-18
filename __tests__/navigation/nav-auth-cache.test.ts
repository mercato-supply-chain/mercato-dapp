import { beforeEach, describe, expect, test } from 'bun:test'
import { NAV_PROFILE_COLUMNS } from '@/lib/navigation/nav-auth'
import {
  invalidateNavProfile,
  loadNavProfile,
  primeNavProfile,
} from '@/lib/navigation/nav-auth-client'

interface FakeProfile {
  id: string
  full_name: string
  user_type: string
}

/** Minimal Supabase-shaped stub: records every select/eq so we can assert dedup. */
function createFakeClient(rows: Record<string, FakeProfile | null>) {
  const calls = { selectColumns: [] as string[], eq: 0 }

  const client = {
    from(table: string) {
      expect(table).toBe('profiles')
      return {
        select(columns: string) {
          calls.selectColumns.push(columns)
          return {
            eq(_column: string, value: string) {
              calls.eq += 1
              return {
                maybeSingle: async () => ({ data: rows[value] ?? null, error: null }),
              }
            },
          }
        },
      }
    },
  }

  return { client, calls }
}

const PROFILE: FakeProfile = { id: 'user-1', full_name: 'Ada', user_type: 'pyme' }

beforeEach(() => {
  invalidateNavProfile()
})

describe('loadNavProfile', () => {
  test('selects only the navigation projection, never select(*)', async () => {
    const { client, calls } = createFakeClient({ 'user-1': PROFILE })

    await loadNavProfile(client as never, 'user-1')

    expect(calls.selectColumns).toEqual([NAV_PROFILE_COLUMNS])
    expect(calls.selectColumns).not.toContain('*')
  })

  test('deduplicates concurrent callers into a single request', async () => {
    const { client, calls } = createFakeClient({ 'user-1': PROFILE })

    const [first, second] = await Promise.all([
      loadNavProfile(client as never, 'user-1'),
      loadNavProfile(client as never, 'user-1'),
    ])

    expect(calls.eq).toBe(1)
    expect(first).toEqual(PROFILE)
    expect(second).toEqual(PROFILE)
  })

  test('serves sequential callers from the cache', async () => {
    const { client, calls } = createFakeClient({ 'user-1': PROFILE })

    await loadNavProfile(client as never, 'user-1')
    await loadNavProfile(client as never, 'user-1')

    expect(calls.eq).toBe(1)
  })

  test('returns the server-primed profile without a request', async () => {
    const { client, calls } = createFakeClient({ 'user-1': PROFILE })
    primeNavProfile('user-1', PROFILE)

    const profile = await loadNavProfile(client as never, 'user-1')

    expect(profile).toEqual(PROFILE)
    expect(calls.eq).toBe(0)
  })

  test('invalidating a user forces the next call to refetch', async () => {
    const { client, calls } = createFakeClient({ 'user-1': PROFILE })

    await loadNavProfile(client as never, 'user-1')
    invalidateNavProfile('user-1')
    await loadNavProfile(client as never, 'user-1')

    expect(calls.eq).toBe(2)
  })

  test('caches a missing profile row instead of refetching', async () => {
    const { client, calls } = createFakeClient({})

    expect(await loadNavProfile(client as never, 'user-1')).toBeNull()
    expect(await loadNavProfile(client as never, 'user-1')).toBeNull()
    expect(calls.eq).toBe(1)
  })
})
