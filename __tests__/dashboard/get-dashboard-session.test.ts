import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import * as supabaseServer from '@/lib/supabase/server'

// Bun's mock.restore() does not undo mock.module(); fall through to the real export afterwards.
const realCreateClient = supabaseServer.createClient

const state = {
  active: true,
  user: null as { id: string } | null,
  profile: null as Record<string, unknown> | null,
  queries: [] as { table: string; columns?: string; eq?: [string, unknown] }[],
}

const client = {
  auth: {
    getUser: async () => ({ data: { user: state.user } }),
  },
  from(table: string) {
    const query: { table: string; columns?: string; eq?: [string, unknown] } = { table }
    state.queries.push(query)
    const builder = {
      select(columns: string) {
        query.columns = columns
        return builder
      },
      eq(column: string, value: unknown) {
        query.eq = [column, value]
        return builder
      },
      async single() {
        return { data: state.profile, error: null }
      },
    }
    return builder
  },
}

mock.module('@/lib/supabase/server', () => ({
  ...supabaseServer,
  createClient: async () => (state.active ? client : realCreateClient()),
}))

const { getDashboardSession } = await import('@/lib/dashboard/get-dashboard-session')

beforeEach(() => {
  state.user = null
  state.profile = null
  state.queries = []
})

afterAll(() => {
  state.active = false
})

// React's cache() only memoizes inside a server render, so these tests cover what one call
// loads - not the layout-and-page deduplication, which is React's request-cache semantics.
test('returns no user and skips the profile query when signed out', async () => {
  const session = await getDashboardSession()

  expect(session.user).toBeNull()
  expect(session.profile).toBeNull()
  expect(session.supabase).toBe(client as never)
  expect(state.queries).toHaveLength(0)
})

test('loads the profile with the projection the layout and investments page share', async () => {
  state.user = { id: 'user-1' }
  state.profile = { user_type: 'investor', full_name: 'Ada', company_name: null, contact_name: null }

  const session = await getDashboardSession()

  expect(session.user).toEqual({ id: 'user-1' } as never)
  expect(session.profile).toEqual(state.profile as never)
  expect(state.queries).toEqual([
    {
      table: 'profiles',
      columns: 'user_type, full_name, company_name, contact_name',
      eq: ['id', 'user-1'],
    },
  ])
})
