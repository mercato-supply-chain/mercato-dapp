import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import * as nextNavigation from 'next/navigation'
import * as i18nServer from '@/lib/i18n/server'
import * as investorPortfolio from '@/lib/investments/get-investor-portfolio'
import * as supabaseServer from '@/lib/supabase/server'

// Bun's mock.restore() does not undo mock.module(), and every test file shares one process.
// So each mock below falls through to the real export once this file is done (afterAll).
const real = {
  redirect: nextNavigation.redirect,
  getServerDictionary: i18nServer.getServerDictionary,
  getInvestorPortfolio: investorPortfolio.getInvestorPortfolio,
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

const messages = {
  investments: { smbFallbackName: 'SMB', dealFallbackTitle: 'Untitled deal' },
}
const investor = {
  user_type: 'investor',
  full_name: 'Ada',
  company_name: null,
  contact_name: null,
}

type UserResult = { data: { user: { id: string } | null } }

const state = {
  active: true,
  started: [] as string[],
  dictionary: () => Promise.resolve(messages) as Promise<unknown>,
  getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) as Promise<UserResult>,
  profile: investor as Record<string, unknown> | null,
  portfolioCalls: [] as unknown[][],
  portfolio: { positions: [] } as unknown,
}

// The real getDashboardSession runs against this request-scoped fake client.
const client = {
  auth: { getUser: () => state.getUser() },
  from() {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: async () => ({ data: state.profile, error: null }),
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

mock.module('@/lib/investments/get-investor-portfolio', () => ({
  ...investorPortfolio,
  getInvestorPortfolio: async (...args: Parameters<typeof real.getInvestorPortfolio>) => {
    if (!state.active) return real.getInvestorPortfolio(...args)
    state.portfolioCalls.push(args)
    return state.portfolio
  },
}))

// Keep every real export so later test files still find usePathname etc.
mock.module('next/navigation', () => ({
  ...nextNavigation,
  redirect: (url: string) => {
    if (!state.active) return real.redirect(url)
    throw new RedirectCalled(url)
  },
}))

const { default: DashboardInvestmentsPage } = await import('@/app/dashboard/investments/page')

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A search-params promise that records when the page starts waiting on it. */
function trackedParams(params: Deferred<{ tab?: string; page?: string }>) {
  return {
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) {
      state.started.push('params')
      return params.promise.then(onFulfilled, onRejected)
    },
  } as unknown as Promise<{ tab?: string; page?: string }>
}

beforeEach(() => {
  state.started = []
  state.dictionary = () => Promise.resolve(messages)
  state.getUser = () => Promise.resolve({ data: { user: { id: 'user-1' } } })
  state.profile = investor
  state.portfolioCalls = []
  state.portfolio = { positions: [] }
})

afterAll(() => {
  state.active = false
})

test('starts the dictionary, search params and session before any of them resolves', async () => {
  const dictionary = deferred<unknown>()
  const signedIn = deferred<UserResult>()
  const params = deferred<{ tab?: string; page?: string }>()
  state.dictionary = () => dictionary.promise
  state.getUser = () => signedIn.promise

  const rendering = DashboardInvestmentsPage({ searchParams: trackedParams(params) })
  await flush()

  // All three are in flight while none has settled: they overlap instead of queueing.
  expect([...state.started].sort()).toEqual(['dictionary', 'params', 'session'])
  expect(state.portfolioCalls).toHaveLength(0)

  dictionary.resolve(messages)
  params.resolve({ page: '2', tab: 'active' })
  await flush()
  // The portfolio is the true dependency chain: it still waits for the user and profile.
  expect(state.portfolioCalls).toHaveLength(0)

  signedIn.resolve({ data: { user: { id: 'user-1' } } })
  const element = (await rendering) as { props: Record<string, unknown> }

  expect(state.portfolioCalls).toEqual([
    [
      client,
      'user-1',
      investor,
      { smbFallback: 'SMB', dealFallbackTitle: 'Untitled deal' },
      { page: 2 },
    ],
  ])
  expect(element.props.tab).toBe('active')
  expect(element.props.t).toBe(messages)
  expect(element.props.portfolio).toBe(state.portfolio)
})

test('redirects a signed-out visitor to login without loading the portfolio', async () => {
  state.getUser = () => Promise.resolve({ data: { user: null } })

  const error = await DashboardInvestmentsPage({ searchParams: { page: '3' } }).catch((e) => e)

  expect(error).toBeInstanceOf(RedirectCalled)
  expect((error as RedirectCalled).url).toBe('/auth/login')
  expect(state.portfolioCalls).toHaveLength(0)
})

test('sends a user with no investor portfolio back to the dashboard', async () => {
  state.portfolio = null

  const error = await DashboardInvestmentsPage({ searchParams: {} }).catch((e) => e)

  expect((error as RedirectCalled).url).toBe('/dashboard')
})

test('keeps the existing page and tab parsing', async () => {
  for (const [params, expectedPage, expectedTab] of [
    [{ page: '-3', tab: 'completed' }, 1, 'completed'],
    [{ page: 'abc', tab: 'nonsense' }, 1, 'all'],
    [{ page: '4' }, 4, 'all'],
  ] as const) {
    state.portfolioCalls = []
    const element = (await DashboardInvestmentsPage({ searchParams: params })) as {
      props: Record<string, unknown>
    }
    expect(state.portfolioCalls[0]?.[4]).toEqual({ page: expectedPage })
    expect(element.props.tab).toBe(expectedTab)
  }

  state.portfolioCalls = []
  await DashboardInvestmentsPage({})
  expect(state.portfolioCalls[0]?.[4]).toEqual({ page: 1 })
})

test('a dictionary failure still fails the page for a signed-in user', async () => {
  state.dictionary = () => Promise.reject(new Error('dictionary unavailable'))

  const error = await DashboardInvestmentsPage({ searchParams: {} }).catch((e) => e)

  expect((error as Error).message).toBe('dictionary unavailable')
  expect(state.portfolioCalls).toHaveLength(0)
})

test('for a signed-out visitor the login redirect wins over a dictionary failure', async () => {
  state.getUser = () => Promise.resolve({ data: { user: null } })
  state.dictionary = () => Promise.reject(new Error('dictionary unavailable'))

  const error = await DashboardInvestmentsPage({ searchParams: {} }).catch((e) => e)

  expect((error as RedirectCalled).url).toBe('/auth/login')
})
