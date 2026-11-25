import { beforeEach, expect, test } from 'bun:test'
import { loadDashboardSession } from '@/lib/dashboard/get-dashboard-session'

// Bun shares one module registry across test files, so mocking '@/lib/supabase/server' here would
// only take effect if this file happened to load the session module first. The session read is
// exercised with an explicit client instead.
const state = {
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

type SessionClient = Parameters<typeof loadDashboardSession>[0]
const sessionClient = client as unknown as SessionClient

beforeEach(() => {
  state.user = null
  state.profile = null
  state.queries = []
})

test('returns no user and skips the profile query when signed out', async () => {
  const session = await loadDashboardSession(sessionClient)

  expect(session.user).toBeNull()
  expect(session.profile).toBeNull()
  expect(session.supabase).toBe(sessionClient)
  expect(state.queries).toHaveLength(0)
})

test('loads the profile with the projection the layout and investments page share', async () => {
  state.user = { id: 'user-1' }
  state.profile = { user_type: 'investor', full_name: 'Ada', company_name: null, contact_name: null }

  const session = await loadDashboardSession(sessionClient)

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
