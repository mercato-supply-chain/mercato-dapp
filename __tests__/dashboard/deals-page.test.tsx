import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import * as nextNavigation from 'next/navigation'
import * as i18nServer from '@/lib/i18n/server'
import * as dashboardData from '@/lib/dashboard/get-dashboard-data'
import * as supabaseServer from '@/lib/supabase/server'

// Bun's mock.restore() does not undo mock.module(), and every test file shares one process.
// So each mock below falls through to the real export once this file is done (afterAll).
const real = {
  redirect: nextNavigation.redirect,
  getServerDictionary: i18nServer.getServerDictionary,
  getDashboardData: dashboardData.getDashboardData,
  createClient: supabaseServer.createClient,
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

class RedirectCalled extends Error {
  constructor(readonly url: string) {
    super(`redirect(${url})`)
  }
}

type Profile = {
  user_type: string | null
  full_name: string | null
  contact_name: string | null
  company_name: string | null
}

type QueryRecord = { table: string; columns?: string; eq?: [string, unknown] }
type UserResult = { data: { user: { id: string; email?: string } | null } }

const messages = { dashboard: {}, dealStatus: {} } as unknown
const user = { id: 'user-1', email: 'supplier@example.com' }
const nonSupplierProfile: Profile = {
  user_type: 'pyme',
  full_name: 'Ada',
  contact_name: null,
  company_name: 'Ada Co',
}
const supplierProfile: Profile = {
  user_type: 'supplier',
  full_name: 'Sam',
  contact_name: 'Sam',
  company_name: 'Sam Supplies',
}
const dashboard = { profile: { fullName: 'Ada', companyName: 'Ada Co', userType: 'pyme' }, deals: [] }

const state = {
  active: true,
  started: [] as string[],
  dictionary: () => Promise.resolve(messages) as Promise<unknown>,
  getUser: () => Promise.resolve({ data: { user } }) as Promise<UserResult>,
  profile: nonSupplierProfile as Profile | null,
  profileSingle: undefined as (() => Promise<{ data: Profile | null; error: null }>) | undefined,
  companies: [] as { id: string; company_name: string | null }[],
  companiesResult: undefined as
    | (() => Promise<{ data: { id: string; company_name: string | null }[]; error: null }>)
    | undefined,
  deals: [] as unknown[],
  queries: [] as QueryRecord[],
  dashboardCalls: [] as unknown[][],
  dashboard: dashboard as unknown,
}

const client = {
  auth: { getUser: () => state.getUser() },
  from(table: string) {
    const record: QueryRecord = { table }
    state.queries.push(record)
    const builder = {
      select(columns?: string) {
        record.columns = columns
        return builder
      },
      eq(column: string, value: unknown) {
        record.eq = [column, value]
        return builder
      },
      in() {
        return builder
      },
      order() {
        return builder
      },
      single: () => (state.profileSingle ? state.profileSingle() : Promise.resolve({ data: state.profile, error: null })),
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) {
        const result = table === 'supplier_companies'
          ? (state.companiesResult
              ? state.companiesResult()
              : Promise.resolve({ data: state.companies, error: null }))
          : Promise.resolve({ data: state.deals, error: null })
        return result.then(onFulfilled, onRejected)
      },
    }
    return builder
  },
}

mock.module('@/lib/supabase/server', () => ({
  ...supabaseServer,
  createClient: async () => {
    if (!state.active) return real.createClient()
    state.started.push('session')
    return client
  },
}))

mock.module('@/lib/i18n/server', () => ({
  ...i18nServer,
  getServerDictionary: () => {
    if (!state.active) return real.getServerDictionary()
    state.started.push('dictionary')
    return state.dictionary()
  },
}))

mock.module('@/lib/dashboard/get-dashboard-data', () => ({
  ...dashboardData,
  getDashboardData: async (...args: Parameters<typeof real.getDashboardData>) => {
    if (!state.active) return real.getDashboardData(...args)
    state.dashboardCalls.push(args)
    return state.dashboard as never
  },
}))

mock.module('next/navigation', () => ({
  ...nextNavigation,
  redirect: (url: string) => {
    if (!state.active) return real.redirect(url)
    throw new RedirectCalled(url)
  },
}))

const { default: DashboardDealsPage } = await import('@/app/dashboard/deals/page')

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  state.started = []
  state.dictionary = () => Promise.resolve(messages)
  state.getUser = () => Promise.resolve({ data: { user } })
  state.profile = nonSupplierProfile
  state.profileSingle = undefined
  state.companies = []
  state.companiesResult = undefined
  state.deals = []
  state.queries = []
  state.dashboardCalls = []
  state.dashboard = dashboard
})

afterAll(() => {
  state.active = false
})

test('starts the dictionary at route entry, before auth resolves', async () => {
  const signedIn = deferred<UserResult>()
  state.getUser = () => signedIn.promise

  const rendering = DashboardDealsPage({ searchParams: {} })
  await flush()

  // The dictionary is already in flight while auth is still pending.
  expect(state.started).toContain('dictionary')

  signedIn.resolve({ data: { user } })
  await rendering
})

test('reads the profile once with explicit columns, never select(*), for non-suppliers', async () => {
  const element = (await DashboardDealsPage({ searchParams: { company: 'c-1' } })) as {
    props: Record<string, unknown>
  }

  const profileQueries = state.queries.filter((q) => q.table === 'profiles')
  expect(profileQueries).toHaveLength(1)
  expect(profileQueries[0]).toEqual({
    table: 'profiles',
    columns: 'user_type, full_name, contact_name, company_name',
    eq: ['id', 'user-1'],
  })
  expect(state.queries.some((q) => q.columns === '*' || q.columns === undefined)).toBe(false)

  // The single read is handed straight to the dashboard loader; no second profile read.
  expect(state.dashboardCalls).toHaveLength(1)
  expect(state.dashboardCalls[0]).toEqual([
    client,
    'user-1',
    nonSupplierProfile,
    'supplier@example.com',
    'c-1',
  ])
  expect(element.props.t).toBe(messages)
  expect(element.props.data).toBe(dashboard)
})

test('overlaps the dictionary with the dashboard data for non-suppliers', async () => {
  const dictionary = deferred<unknown>()
  state.dictionary = () => dictionary.promise

  const rendering = DashboardDealsPage({ searchParams: {} })
  await flush()

  // Dashboard loading has started even though the dictionary has not settled.
  expect(state.dashboardCalls).toHaveLength(1)

  dictionary.resolve(messages)
  const element = (await rendering) as { props: Record<string, unknown> }
  expect(element.props.t).toBe(messages)
})

test('overlaps the dictionary with the supplier companies query', async () => {
  state.profile = supplierProfile
  const dictionary = deferred<unknown>()
  const companies = deferred<{ data: { id: string; company_name: string | null }[]; error: null }>()
  state.dictionary = () => dictionary.promise
  state.companiesResult = () => companies.promise

  const rendering = DashboardDealsPage({ searchParams: {} })
  await flush()

  // The companies query is waiting while the dictionary is still pending, and no deals query
  // has started yet because it depends on the company ids.
  expect(state.queries.some((q) => q.table === 'supplier_companies')).toBe(true)
  expect(state.queries.some((q) => q.table === 'deals')).toBe(false)

  companies.resolve({ data: [{ id: 'c-1', company_name: 'Sam Supplies' }], error: null })
  dictionary.resolve(messages)
  await rendering

  expect(state.queries.some((q) => q.table === 'deals')).toBe(true)
})

test('redirects a signed-out visitor to login without reading a profile', async () => {
  state.getUser = () => Promise.resolve({ data: { user: null } })

  const error = await DashboardDealsPage({ searchParams: {} }).catch((e) => e)

  expect(error).toBeInstanceOf(RedirectCalled)
  expect((error as RedirectCalled).url).toBe('/auth/login')
  expect(state.queries).toHaveLength(0)
  expect(state.dashboardCalls).toHaveLength(0)
})
