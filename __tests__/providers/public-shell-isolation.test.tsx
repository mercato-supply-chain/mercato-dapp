import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import * as NextNavigationNamespace from 'next/navigation'
import * as PollarReactNamespace from '@pollar/react'
import * as SwkNamespace from '@creit.tech/stellar-wallets-kit'
import * as EscrowHooksNamespace from '@trustless-work/escrow/hooks'

// Load unmocked repo modules via `?actual` so prior test files in single-process `bun test`
// cannot poison our baseline snapshots (matching `__tests__/i18n/provider.test.tsx`).
const realSupabaseModPath: string = '@/lib/supabase/client.ts?actual'
const realNotificationsCacheModPath: string = '@/lib/client/notifications-cache.ts?actual'
const realI18nProviderModPath: string = '@/lib/i18n/provider.tsx?actual'
const realUseWalletModPath: string = '@/hooks/use-wallet.ts?actual'
const realMercatoWalletModPath: string = '@/lib/mercato-wallet.ts?actual'

const SupabaseClientOriginal = (await import(
  realSupabaseModPath
)) as typeof import('@/lib/supabase/client')
const NotificationsCacheOriginal = (await import(
  realNotificationsCacheModPath
)) as typeof import('@/lib/client/notifications-cache')
const I18nProviderOriginal = (await import(
  realI18nProviderModPath
)) as typeof import('@/lib/i18n/provider')
const UseWalletOriginal = (await import(
  realUseWalletModPath
)) as typeof import('@/hooks/use-wallet')
const MercatoWalletOriginal = (await import(
  realMercatoWalletModPath
)) as typeof import('@/lib/mercato-wallet')

const NextNavigationOriginal = { ...NextNavigationNamespace }
const PollarReactOriginal = { ...PollarReactNamespace }
const SwkOriginal = { ...SwkNamespace }
const EscrowHooksOriginal = { ...EscrowHooksNamespace }
const OriginalGlobalFetch = globalThis.fetch
const OriginalPollarPublishableKey = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY

const REPO_ROOT = resolve(import.meta.dir, '../..')

function toPosixPath(p: string): string {
  return p.replaceAll('\\', '/')
}

function readRepoFile(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8')
}

function isRegularFile(filePath: string): boolean {
  return existsSync(filePath) && statSync(filePath).isFile()
}

function resolveImportTarget(fromFile: string, specifier: string): string | null {
  const basePath = specifier.startsWith('@/')
    ? resolve(REPO_ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(resolve(REPO_ROOT, fromFile)), specifier)
      : null

  if (!basePath) return null

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    resolve(basePath, 'index.ts'),
    resolve(basePath, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (isRegularFile(candidate)) {
      return toPosixPath(candidate.slice(REPO_ROOT.length + 1))
    }
  }
  return null
}

/**
 * Character-level lexer that strips line comments (`//...`) and block comments (`/*...* /`)
 * while preserving string/template literals verbatim (including strings containing `/*` or `//`).
 */
function stripCommentsLexically(source: string): string {
  let out = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const ch = source[i]
    const next = source[i + 1]
    if (ch === '/' && next === '/') {
      i += 2
      while (i < n && source[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      i += 2
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n'
        i += 1
      }
      i += 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      out += ch
      i += 1
      while (i < n) {
        const c = source[i]
        out += c
        i += 1
        if (c === '\\' && i < n) {
          out += source[i]
          i += 1
          continue
        }
        if (c === quote) break
      }
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function extractRuntimeSpecifiers(
  source: string,
): { staticSpecifiers: string[]; dynamicSpecifiers: string[] } {
  const cleaned = stripCommentsLexically(source)
  const staticSpecifiers: string[] = []
  const dynamicSpecifiers: string[] = []

  const staticRegex =
    /\b(?:import|export)\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null = staticRegex.exec(cleaned)
  while (match) {
    const fullMatch = match[0]
    if (!/\b(?:import|export)\s+type\b/.test(fullMatch)) {
      const clauseMatch = fullMatch.match(/\{([\s\S]*?)\}/)
      if (clauseMatch) {
        const items = clauseMatch[1]
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
        const hasRuntimeBinding = items.some((item) => !item.startsWith('type '))
        const hasDefaultBinding = /^\bimport\s+[A-Za-z_$][\w$]*\s*,/.test(fullMatch)
        if (hasRuntimeBinding || hasDefaultBinding) {
          staticSpecifiers.push(match[1])
        }
      } else {
        staticSpecifiers.push(match[1])
      }
    }
    match = staticRegex.exec(cleaned)
  }

  const dynamicRegex = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let dynMatch: RegExpExecArray | null = dynamicRegex.exec(cleaned)
  while (dynMatch) {
    dynamicSpecifiers.push(dynMatch[1])
    dynMatch = dynamicRegex.exec(cleaned)
  }

  return { staticSpecifiers, dynamicSpecifiers }
}

function collectReachableGraph(
  entryFiles: string[],
  options: { includeDynamic?: boolean } = { includeDynamic: true },
) {
  const visitedFiles = new Set<string>()
  const externalPackages = new Set<string>()
  const queue = entryFiles.map(toPosixPath)
  const includeDynamic = options.includeDynamic ?? true

  while (queue.length > 0) {
    const current = toPosixPath(queue.shift()!)
    if (visitedFiles.has(current)) continue
    visitedFiles.add(current)

    const source = readRepoFile(current)
    const { staticSpecifiers, dynamicSpecifiers } = extractRuntimeSpecifiers(source)
    const specs = includeDynamic
      ? [...staticSpecifiers, ...dynamicSpecifiers]
      : staticSpecifiers

    for (const spec of specs) {
      if (spec.startsWith('@/') || spec.startsWith('.')) {
        const target = resolveImportTarget(current, spec)
        if (target && !visitedFiles.has(target)) {
          queue.push(target)
        }
      } else {
        externalPackages.add(spec)
      }
    }
  }

  return { visitedFiles, externalPackages }
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

let activePathname = '/'
let activeParams: Record<string, string> = {}
let currentAuthUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null
let pendingProfilePromiseMode = false
let resolvePendingProfile: ((profile: { id: string; user_type: string | null } | null) => void) | null = null
const routerReplaceCalls: string[] = []
const profileUpdates: Array<{ id: string; payload: Record<string, unknown> }> = []
const authStateListeners = new Set<
  (event: string, session: { user: typeof currentAuthUser } | null) => void
>()

const stableRouter = {
  push: () => undefined,
  replace: (dest: string) => {
    routerReplaceCalls.push(dest)
  },
  refresh: () => undefined,
  prefetch: () => undefined,
  back: () => undefined,
  forward: () => undefined,
}
const stableSearchParams = new URLSearchParams()

const pollarAuthListeners = new Set<(state: unknown) => void>()

const pollarMockState: {
  enabled: boolean
  isAuthenticated: boolean
  verified: boolean
  walletObj: { address: string; provisioning: 'CREATING' | 'READY' } | null
  walletId: string
  userId: string
  clientSessionId: string
  accessToken: string | undefined
  logoutImpl: () => Promise<void> | void
  loginImpl: () => void
  openModalImpl: () => void
} = {
  enabled: false,
  isAuthenticated: false,
  verified: false,
  walletObj: null,
  walletId: 'pollar-wallet-a',
  userId: 'pollar-uid-a',
  clientSessionId: 'pollar-csid-a',
  accessToken: 'pollar-access-token-a',
  logoutImpl: () => undefined,
  loginImpl: () => undefined,
  openModalImpl: () => undefined,
}

function emitPollarAuthStateChange(stepOverride?: string) {
  const nextState =
    stepOverride && stepOverride !== 'authenticated'
      ? { step: stepOverride }
      : pollarMockState.isAuthenticated
        ? {
            step: 'authenticated' as const,
            verified: pollarMockState.verified,
            session: {
              userId: pollarMockState.userId,
              clientSessionId: pollarMockState.clientSessionId,
              walletId: pollarMockState.walletId,
              token: pollarMockState.accessToken
                ? { accessToken: pollarMockState.accessToken }
                : undefined,
              wallet: pollarMockState.walletObj ? { ...pollarMockState.walletObj } : undefined,
            },
          }
        : { step: 'idle' as const }
  for (const cb of pollarAuthListeners) {
    cb(nextState)
  }
}

let pollarLogoutCalls = 0

const getUserMock = mock(async () => ({ data: { user: currentAuthUser }, error: null }))
const signOutMock = mock(async () => ({ error: null }))
const onAuthStateChangeMock = mock(
  (cb: (event: string, session: { user: typeof currentAuthUser } | null) => void) => {
    authStateListeners.add(cb)
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authStateListeners.delete(cb)
          },
        },
      },
    }
  },
)

mock.module('next/navigation', () => ({
  ...NextNavigationOriginal,
  useRouter: () => stableRouter,
  usePathname: () => activePathname,
  useParams: () => activeParams,
  useSearchParams: () => stableSearchParams,
}))

const stablePollarClient = {
  getAuthState: () =>
    pollarMockState.isAuthenticated
      ? {
          step: 'authenticated' as const,
          // Matches @pollar/core _cloneAuthState() which clones session (including wallet) on every call
          session: {
            userId: pollarMockState.userId,
            clientSessionId: pollarMockState.clientSessionId,
            walletId: pollarMockState.walletId,
            token: pollarMockState.accessToken
              ? { accessToken: pollarMockState.accessToken }
              : undefined,
            wallet: pollarMockState.walletObj ? { ...pollarMockState.walletObj } : undefined,
          },
        }
      : { step: 'unauthenticated' as const },
  getUserProfile: () => ({ mail: 'a@test.com', first_name: 'Alice', last_name: 'A' }),
  onAuthStateChange: (cb: (state: unknown) => void) => {
    pollarAuthListeners.add(cb)
    return () => {
      pollarAuthListeners.delete(cb)
    }
  },
}

const stablePollarLogin = () => {
  pollarMockState.loginImpl()
}
const stablePollarOpenModal = () => {
  pollarMockState.openModalImpl()
}
const stablePollarRefreshBalance = async () => undefined
const stablePollarGetClient = () => stablePollarClient
const stablePollarLogout = () => {
  pollarLogoutCalls += 1
  return pollarMockState.logoutImpl()
}
const stablePollarSignAndSubmit = async () => ({
  status: 'success' as const,
  hash: 'POLLAR_SIGNED_TX_HASH_1',
})
const stableIdleTxHistory = { step: 'idle' as const }
const stableIdleBalance = { step: 'idle' as const }

mock.module('@pollar/react', () => ({
  ...PollarReactOriginal,
  PollarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePollar: () => ({
    isAuthenticated: pollarMockState.enabled ? pollarMockState.isAuthenticated : false,
    verified: pollarMockState.enabled ? pollarMockState.verified : false,
    wallet: pollarMockState.enabled ? pollarMockState.walletObj : null,
    txHistory: stableIdleTxHistory,
    walletBalance: stableIdleBalance,
    login: stablePollarLogin,
    logout: stablePollarLogout,
    openLoginModal: stablePollarOpenModal,
    refreshWalletBalance: stablePollarRefreshBalance,
    getClient: stablePollarGetClient,
    signAndSubmitTx: stablePollarSignAndSubmit,
  }),
}))

const stableSupabaseClient = {
  auth: {
    getUser: getUserMock,
    signOut: signOutMock,
    onAuthStateChange: onAuthStateChangeMock,
    verifyOtp: async () => ({ data: {}, error: null }),
  },
  channel: () => {
    const ch = {
      on: () => ch,
      subscribe: () => ch,
    }
    return ch
  },
  removeChannel: () => undefined,
  from: (table: string) => ({
    select: () => ({
      eq: (_col: string, val: string) => ({
        maybeSingle: async () => {
          if (table === 'profiles' && pendingProfilePromiseMode) {
            const resolved = await new Promise<{ id: string; user_type: string | null } | null>(
              (res) => {
                resolvePendingProfile = res
              },
            )
            return { data: resolved, error: null }
          }
          return {
            data:
              table === 'profiles'
                ? { id: val, user_type: val.startsWith('pyme-') ? 'pyme' : 'investor' }
                : null,
            error: null,
          }
        },
        single: async () => {
          if (table === 'profiles') {
            return {
              data: { id: val, user_type: val.startsWith('pyme-') ? 'pyme' : 'investor' },
              error: null,
            }
          }
          if (table === 'deals') {
            return {
              data: {
                id: val,
                pyme_id: 'pyme-int-1',
                title: 'Integrated Solar Inverters',
                description: 'Batch of 40 solar inverters',
                category: 'electronics',
                product_name: 'Integrated Solar Inverters',
                product_quantity: 40,
                product_unit_price: 250,
                supplier_name: 'Andes Solar Co',
                supplier_address: 'GSUPPLIERADDRESS1111111111111111111111111111111111111111',
                amount: 10000,
                interest_rate: 12,
                term_days: 60,
                status: 'funded',
                repayment_status: 'none',
                milestones: [],
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
      }),
    }),
    update: (payload: Record<string, unknown>) => ({
      eq: (_col: string, id: string) => {
        if (table === 'profiles') {
          profileUpdates.push({ id, payload })
        }
        const chain = {
          eq: () => chain,
          is: () => chain,
          then: (resolvePromise: (val: { error: null }) => unknown) =>
            Promise.resolve({ error: null }).then(resolvePromise),
        }
        return chain
      },
    }),
    insert: async () => ({ error: null }),
  }),
} as unknown as ReturnType<typeof SupabaseClientOriginal.createClient>

mock.module('@/lib/supabase/client', () => ({
  ...SupabaseClientOriginal,
  createClient: () => stableSupabaseClient,
}))

beforeEach(() => {
  mock.module('@/lib/i18n/provider', () => ({ ...I18nProviderOriginal }))
  mock.module('@/hooks/use-wallet', () => ({ ...UseWalletOriginal }))
  mock.module('@/lib/mercato-wallet', () => ({
    ...MercatoWalletOriginal,
    fetchHorizonBalances: async () => ({
      xlm: '25.00',
      usdc: '100.00',
      records: [],
      source: 'horizon' as const,
      updatedAt: '2026-11-20T00:00:00.000Z',
    }),
  }))
  mock.module('@trustless-work/escrow/hooks', () => ({
    ...EscrowHooksOriginal,
    useGetEscrowFromIndexerByContractIds: () => ({
      getEscrowByContractIds: async () => [],
    }),
  }))
  activePathname = '/'
  activeParams = {}
  currentAuthUser = null
  pendingProfilePromiseMode = false
  resolvePendingProfile = null
  routerReplaceCalls.length = 0
  profileUpdates.length = 0
  authStateListeners.clear()
  pollarAuthListeners.clear()
  pollarMockState.enabled = false
  pollarMockState.isAuthenticated = false
  pollarMockState.verified = false
  pollarMockState.walletObj = null
  pollarMockState.walletId = 'pollar-wallet-a'
  pollarMockState.userId = 'pollar-uid-a'
  pollarMockState.clientSessionId = 'pollar-csid-a'
  pollarMockState.accessToken = 'pollar-access-token-a'
  pollarMockState.logoutImpl = () => {
    pollarMockState.isAuthenticated = false
    pollarMockState.verified = false
    pollarMockState.walletObj = null
  }
  pollarMockState.loginImpl = () => undefined
  pollarMockState.openModalImpl = () => undefined
  pollarLogoutCalls = 0
  delete process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY

  // Stub fetch so Horizon balance lookups and Pollar sync never touch offline network sockets
  globalThis.fetch = mock(
    async () =>
      new Response(
        JSON.stringify({
          balances: [{ asset_type: 'native', balance: '25.00' }],
          token_hash: 'stub-token-hash',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
  ) as unknown as typeof fetch

  getUserMock.mockClear()
  signOutMock.mockClear()
  onAuthStateChangeMock.mockClear()

  const domWin = document.defaultView
  if (domWin && globalThis.window !== domWin) {
    globalThis.window = domWin
  }

  if (!window.localStorage || typeof window.localStorage.clear !== 'function') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: createMemoryStorage(),
    })
  } else {
    window.localStorage.clear()
  }

  if (!window.sessionStorage || typeof window.sessionStorage.clear !== 'function') {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      writable: true,
      value: createMemoryStorage(),
    })
  } else {
    window.sessionStorage.clear()
  }

  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
  }
})

afterEach(async () => {
  cleanup()
  globalThis.fetch = OriginalGlobalFetch
  const { resetStellarWalletKit } = await import('@/lib/trustless/lazy-wallet-kit')
  resetStellarWalletKit()
  const { resetRevokedPollarSessions } = await import('@/lib/wallet/session-cleanup')
  resetRevokedPollarSessions()
})

afterAll(async () => {
  if (typeof document !== 'undefined' && document.defaultView) {
    globalThis.window = document.defaultView
  }
  globalThis.fetch = OriginalGlobalFetch
  if (OriginalPollarPublishableKey === undefined) {
    delete process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY
  } else {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = OriginalPollarPublishableKey
  }
  mock.module('next/navigation', () => ({ ...NextNavigationOriginal }))
  mock.module('@pollar/react', () => ({ ...PollarReactOriginal }))
  mock.module('@/lib/supabase/client', () => ({ ...SupabaseClientOriginal }))
  mock.module('@/lib/client/notifications-cache', () => ({ ...NotificationsCacheOriginal }))
  mock.module('@/lib/i18n/provider', () => ({ ...I18nProviderOriginal }))
  mock.module('@/hooks/use-wallet', () => ({ ...UseWalletOriginal }))
  mock.module('@/lib/mercato-wallet', () => ({ ...MercatoWalletOriginal }))
  mock.module('@creit.tech/stellar-wallets-kit', () => ({ ...SwkOriginal }))
  mock.module('@trustless-work/escrow/hooks', () => ({ ...EscrowHooksOriginal }))
})

const realDictionariesModPath: string = '@/lib/i18n/dictionaries.ts?actual'
const realNavigationModPath: string = '@/components/navigation.tsx?actual'

async function loadAppProviders() {
  try {
    return await import('@/components/providers/app-providers')
  } catch {
    // Bun 1.3.14 freezes ESM export slots if an earlier upstream suite (e.g. user-menu-content.test.tsx)
    // partially mocked `@/lib/i18n/provider` without `I18nProvider` before the real module was instantiated.
    // Keep canonical `NavAuthProvider` / `ThemeProvider` (same React Context singletons) and pair with `?actual` `I18nProvider`.
    const { ThemeProvider } = await import('@/components/theme-provider')
    const { NavAuthProvider } = await import('@/components/providers/nav-auth-provider')
    const { enDict } = (await import(
      realDictionariesModPath
    )) as typeof import('@/lib/i18n/dictionaries')
    const FallbackAppProviders = ({
      children,
      locale = 'en',
      messages,
      navAuth,
    }: {
      children: React.ReactNode
      locale?: 'en' | 'es'
      messages?: typeof enDict
      navAuth?: { user: { id: string; email?: string | null } | null; profile: unknown }
    }) => (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <I18nProviderOriginal.I18nProvider locale={locale} messages={messages ?? enDict}>
          <NavAuthProvider initial={(navAuth ?? { user: null, profile: null }) as never}>
            {children}
          </NavAuthProvider>
        </I18nProviderOriginal.I18nProvider>
      </ThemeProvider>
    )
    return {
      AppProviders:
        FallbackAppProviders as unknown as (typeof import('@/components/providers/app-providers'))['AppProviders'],
    }
  }
}

async function loadNavigation() {
  try {
    return (await import(realNavigationModPath)) as typeof import('@/components/navigation')
  } catch {
    return {
      Navigation: (() => <nav data-testid="fallback-nav" />) as unknown as (typeof import('@/components/navigation'))['Navigation'],
    }
  }
}

describe('Issue #278 — Public shell provider, SDK graph, route coverage & session isolation', () => {
  it('removes @pollar/react/styles.css from root app/layout.tsx and co-locates it in PollarProvider', () => {
    const rootLayout = readRepoFile('app/layout.tsx')
    const pollarProvider = readRepoFile('providers/pollar-provider.tsx')
    expect(rootLayout).not.toContain('@pollar/react/styles.css')
    expect(pollarProvider).toContain('@pollar/react/styles.css')
  })

  it('restricts AppProviders to theme, i18n, and server-primed nav auth only', () => {
    const appProviders = readRepoFile('components/providers/app-providers.tsx')
    expect(appProviders).toContain('ThemeProvider')
    expect(appProviders).toContain('I18nProvider')
    expect(appProviders).toContain('NavAuthProvider')
    expect(appProviders).not.toContain('PollarProvider')
    expect(appProviders).not.toContain('TrustlessWorkProvider')
    expect(appProviders).not.toContain('WalletProvider')
    expect(appProviders).not.toContain('NotificationsProvider')
  })

  it('severs static and dynamic imports from public routes and /auth/forgot-password to Pollar, wallet kit, TrustlessWork, and NotificationsProvider', () => {
    const { visitedFiles, externalPackages } = collectReachableGraph([
      'app/layout.tsx',
      'app/page.tsx',
      'app/how-it-works/page.tsx',
      'app/our-story/page.tsx',
      'app/traction/page.tsx',
      'app/marketplace/page.tsx',
      'app/orders/page.tsx',
      'app/deals/page.tsx',
      'app/blog/page.tsx',
      'app/blog/[slug]/page.tsx',
      'app/investors/page.tsx',
      'app/investors/[id]/page.tsx',
      'app/pymes/page.tsx',
      'app/pymes/[id]/page.tsx',
      'app/suppliers/page.tsx',
      'app/suppliers/[id]/page.tsx',
      'app/events/[slug]/page.tsx',
      'app/login/page.tsx',
      'app/sign-up/page.tsx',
      'app/auth/forgot-password/page.tsx',
      'app/auth/sign-up-success/page.tsx',
      'app/auth/update-password/page.tsx',
      'components/providers/app-providers.tsx',
      'components/navigation.tsx',
    ])

    // Positive control anchors proving resolved relative/alias imports use normalized POSIX paths
    expect(visitedFiles.has('components/providers/nav-auth-provider.tsx')).toBe(true)
    expect(visitedFiles.has('providers/wallet-context.ts')).toBe(true)
    expect(visitedFiles.has('components/notifications/notifications-context.ts')).toBe(true)

    expect(visitedFiles.has('providers/pollar-provider.tsx')).toBe(false)
    expect(visitedFiles.has('providers/wallet-provider.tsx')).toBe(false)
    expect(visitedFiles.has('lib/trustless/lazy-wallet-kit.ts')).toBe(false)
    expect(visitedFiles.has('components/notifications/notifications-provider.tsx')).toBe(false)

    expect(externalPackages.has('@pollar/react')).toBe(false)
    expect(externalPackages.has('@pollar/core')).toBe(false)
    expect(externalPackages.has('@pollar/react/styles.css')).toBe(false)
    expect(externalPackages.has('@creit.tech/stellar-wallets-kit')).toBe(false)
    expect(externalPackages.has('@trustless-work/escrow')).toBe(false)
  })

  it('[278-P1-3] isolates /auth/login and /auth/sign-up from @trustless-work/escrow, NotificationsProvider, and eager static @creit.tech/stellar-wallets-kit imports', () => {
    expect(existsSync(resolve(REPO_ROOT, 'app/auth/layout.tsx'))).toBe(false)
    expect(existsSync(resolve(REPO_ROOT, 'app/auth/login/layout.tsx'))).toBe(true)
    expect(existsSync(resolve(REPO_ROOT, 'app/auth/sign-up/layout.tsx'))).toBe(true)

    const fullGraph = collectReachableGraph([
      'app/auth/login/layout.tsx',
      'app/auth/sign-up/layout.tsx',
    ])
    expect(fullGraph.visitedFiles.has('providers/pollar-provider.tsx')).toBe(true)
    expect(fullGraph.visitedFiles.has('providers/wallet-provider.tsx')).toBe(true)
    expect(fullGraph.visitedFiles.has('components/notifications/notifications-provider.tsx')).toBe(false)
    expect(fullGraph.externalPackages.has('@trustless-work/escrow')).toBe(false)

    const staticOnlyGraph = collectReachableGraph(
      ['app/auth/login/layout.tsx', 'app/auth/sign-up/layout.tsx'],
      { includeDynamic: false },
    )
    expect(staticOnlyGraph.externalPackages.has('@creit.tech/stellar-wallets-kit')).toBe(false)
  })

  it('[278-P1-4] mounts WalletAppProviders on /dashboard/wallets and deal funding so wallet connect and signing work end-to-end', async () => {
    for (const rel of [
      'components/dashboard/dashboard-shell.tsx',
      'app/deals/[id]/layout.tsx',
      'app/create-deal/layout.tsx',
      'app/settings/layout.tsx',
    ]) {
      expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true)
      expect(readRepoFile(rel)).toContain('WalletAppProviders')
    }

    let signTxCalls = 0
    mock.module('@creit.tech/stellar-wallets-kit', () => ({
      StellarWalletsKit: class {
        openModal({ onWalletSelected }: { onWalletSelected: (opt: { id: string; name: string }) => Promise<void> }) {
          return onWalletSelected({ id: 'freighter', name: 'Freighter' })
        }
        setWallet() {}
        async getAddress() {
          return { address: 'GWALLETKITINVESTOR11111111111111111111111111111111111111' }
        }
        async signTransaction() {
          signTxCalls += 1
          return { signedTxXdr: 'SIGNED_XDR_PAYLOAD' }
        }
        async disconnect() {}
      },
      WalletNetwork: { TESTNET: 'test', PUBLIC: 'public' },
      FREIGHTER_ID: 'freighter',
      AlbedoModule: class {},
      FreighterModule: class {},
    }))
    mock.module('@/lib/client/notifications-cache', () => ({
      ...NotificationsCacheOriginal,
      notificationsRequest: {
        ...NotificationsCacheOriginal.notificationsRequest,
        fetch: async () => [],
        invalidate: () => undefined,
      },
    }))

    activePathname = '/dashboard/wallets'
    currentAuthUser = { id: 'investor-278', email: 'investor@mercato.test' }

    const { AppProviders } = await loadAppProviders()
    const { DashboardShell } = await import('@/components/dashboard/dashboard-shell')
    const { WalletStatusCard } = await import('@/components/wallet/wallet-status-card')
    const { signTransaction } = await import('@/lib/trustless/wallet-kit')

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <AppProviders
          locale="en"
          navAuth={{
            user: currentAuthUser,
            profile: { id: 'investor-278', user_type: 'investor' } as never,
          }}
        >
          <DashboardShell userType="investor">
            <WalletStatusCard />
          </DashboardShell>
        </AppProviders>,
      )
    })

    const connectBtn = view.getByRole('button', { name: /Connect Stellar Wallet/i })
    await act(async () => {
      fireEvent.click(connectBtn)
    })

    await waitFor(() =>
      expect(view.container.textContent).toContain(
        'GWALLETKITINVESTOR11111111111111111111111111111111111111',
      ),
    )

    const signed = await signTransaction({
      unsignedTransaction: 'UNSIGNED_SPLIT_XDR',
      address: 'GWALLETKITINVESTOR11111111111111111111111111111111111111',
    })
    expect(signed).toBe('SIGNED_XDR_PAYLOAD')
    expect(signTxCalls).toBe(1)
  }, 20_000)

  it('renders real <DealDetailLayout> + <DealDetailPage> and unauthenticated public shell with zero anonymous supabase.auth.getUser() calls', async () => {
    mock.module('@/lib/client/notifications-cache', () => ({
      ...NotificationsCacheOriginal,
      notificationsRequest: {
        ...NotificationsCacheOriginal.notificationsRequest,
        fetch: async () => [],
        invalidate: () => undefined,
      },
    }))

    const { AppProviders } = await loadAppProviders()
    const { Navigation } = await loadNavigation()
    const { WalletAppProviders } = await import('@/components/providers/wallet-app-providers')

    let anonView!: ReturnType<typeof render>
    await act(async () => {
      anonView = render(
        <AppProviders locale="en" navAuth={{ user: null, profile: null }}>
          <Navigation />
          <WalletAppProviders>
            <main>Anonymous deal viewer</main>
          </WalletAppProviders>
        </AppProviders>,
      )
    })

    expect(anonView.getByText('Anonymous deal viewer')).toBeTruthy()
    expect(getUserMock).not.toHaveBeenCalled()
    cleanup()

    activePathname = '/deals/deal-int-1'
    activeParams = { id: 'deal-int-1' }
    currentAuthUser = { id: 'pyme-int-1', email: 'pyme@mercato.test' }

    // If an earlier suite in single-process `bun test` (e.g. `__tests__/use-vault-balance.test.tsx`)
    // partially mocked `@/lib/defindex/vault-cache` without `vaultMetaRequest`, stub `useDefindex`
    // only on link failure; otherwise keep the real unmocked module.
    try {
      await import('@/hooks/useDefindex')
    } catch {
      mock.module('@/hooks/useDefindex', () => ({
        useDefindex: () => ({
          vaultBalance: 0,
          walletBalance: 0,
          isLoadingBalances: false,
          balanceError: null,
          vaultMeta: null,
          vaultInfoError: null,
          refreshBalances: async () => undefined,
          depositToVault: async () => null,
          withdrawFromVault: async () => null,
          isConfigured: false,
        }),
      }))
    }

    const { default: DealDetailLayout } = await import('@/app/deals/[id]/layout')
    const { default: DealDetailPage } = await import('@/app/deals/[id]/deal-detail-view')

    let dealView!: ReturnType<typeof render>
    await act(async () => {
      dealView = render(
        <AppProviders
          locale="en"
          navAuth={{
            user: currentAuthUser,
            profile: { id: 'pyme-int-1', user_type: 'pyme' } as never,
          }}
        >
          <DealDetailLayout>
            <DealDetailPage />
          </DealDetailLayout>
        </AppProviders>,
      )
    })

    await waitFor(() =>
      expect(dealView.getAllByText('Integrated Solar Inverters').length).toBeGreaterThan(0),
    )
    expect(dealView.container.textContent).not.toMatch(/\bdealDetail\.[A-Za-z0-9_]+/)
  }, 20_000)

  it('[278-P0-1 / ADV-278-1 & ADV-278-2] blocks active Pollar session and external wallet cross-account leakage across multiple remounts without overwriting Account B profile', async () => {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = 'pk_test_cleanroom_278'
    pollarMockState.enabled = true
    pollarMockState.isAuthenticated = true
    pollarMockState.verified = true
    pollarMockState.walletObj = {
      address: 'GPOLLARACCOUNTAPUBLICKEY11111111111111111111111111111111',
      provisioning: 'READY',
    }
    // Simulate a hung Pollar SDK logout that never clears SDK memory on its own
    pollarMockState.logoutImpl = () => undefined

    window.localStorage.setItem(
      'mercato_wallet',
      JSON.stringify({
        provider: 'pollar',
        publicKey: 'GPOLLARACCOUNTAPUBLICKEY11111111111111111111111111111111',
        isEmbedded: true,
      }),
    )
    window.localStorage.setItem('mercato_wallet_owner', 'user-a')
    currentAuthUser = { id: 'user-b', email: 'b@test.com' }

    const { AppProviders } = await loadAppProviders()
    const { PollarProvider } = await import('@/providers/pollar-provider')
    const { WalletProvider, useWalletContext } = await import('@/providers/wallet-provider')

    function WalletProbe() {
      const { publicKey, canSignTransactions } = useWalletContext()
      return (
        <div data-testid="wallet-probe">
          key={publicKey ?? 'NONE'};sign={String(canSignTransactions)}
        </div>
      )
    }

    let mount1!: ReturnType<typeof render>
    await act(async () => {
      mount1 = render(
        <AppProviders locale="en" navAuth={{ user: currentAuthUser, profile: null }}>
          <PollarProvider>
            <WalletProvider>
              <WalletProbe />
            </WalletProvider>
          </PollarProvider>
        </AppProviders>,
      )
    })

    expect(pollarLogoutCalls).toBeGreaterThanOrEqual(1)
    expect(mount1.getByTestId('wallet-probe').textContent).toBe('key=NONE;sign=false')
    cleanup()

    // Mount 2 (simulating client route navigation to /deals/[id] while SDK memory still holds Account A)
    let mount2!: ReturnType<typeof render>
    await act(async () => {
      mount2 = render(
        <AppProviders locale="en" navAuth={{ user: currentAuthUser, profile: null }}>
          <PollarProvider>
            <WalletProvider>
              <WalletProbe />
            </WalletProvider>
          </PollarProvider>
        </AppProviders>,
      )
    })

    expect(mount2.getByTestId('wallet-probe').textContent).toBe('key=NONE;sign=false')
    expect(
      profileUpdates.some(
        (u) =>
          u.id === 'user-b' &&
          u.payload.stellar_public_key ===
            'GPOLLARACCOUNTAPUBLICKEY11111111111111111111111111111111',
      ),
    ).toBe(false)
    cleanup()

    // External wallet bound to 'user-a' must never flash User A's key when User B mounts
    pollarMockState.enabled = false
    window.localStorage.setItem(
      'mercato_wallet',
      JSON.stringify({
        provider: 'stellar-wallets-kit',
        publicKey: 'GFREIGHTERUSERA11111111111111111111111111111111111111111',
        isEmbedded: false,
      }),
    )
    window.localStorage.setItem('mercato_wallet_owner', 'user-a')
    const observedKeys: string[] = []

    function FlashProbe() {
      const { publicKey } = useWalletContext()
      observedKeys.push(publicKey ?? 'NONE')
      return null
    }

    await act(async () => {
      render(
        <AppProviders locale="en" navAuth={{ user: currentAuthUser, profile: null }}>
          <PollarProvider>
            <WalletProvider>
              <FlashProbe />
            </WalletProvider>
          </PollarProvider>
        </AppProviders>,
      )
    })

    expect(observedKeys).not.toContain(
      'GFREIGHTERUSERA11111111111111111111111111111111111111111',
    )
  })

  it('[278-P1-1 & 278-P1-2 & 278-P1-3] prevents PollarSessionBridge re-render write amplification, blocks hung-logout session resurrection, and holds UserTypeGate while profile loads', async () => {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = 'pk_test_cleanroom_278'
    pollarMockState.enabled = true
    pollarMockState.isAuthenticated = true
    pollarMockState.verified = true
    pollarMockState.walletObj = {
      address: 'GPOLLARSTABLE1111111111111111111111111111111111111111111',
      provisioning: 'READY',
    }
    pollarMockState.accessToken = 'pollar-token-stable-1'
    currentAuthUser = { id: 'user-stable', email: 'stable@test.com' }

    const { AppProviders } = await loadAppProviders()
    const { PollarProvider } = await import('@/providers/pollar-provider')
    const { WalletProvider, useWalletContext } = await import('@/providers/wallet-provider')
    const { UserTypeGate } = await import('@/components/user-type-gate')

    let bumpRender!: () => void
    let triggerDisconnect!: () => Promise<void>

    function ReRenderHarness() {
      const [count, setCount] = useState(0)
      bumpRender = () => setCount((c) => c + 1)
      return (
        <PollarProvider>
          <WalletProvider>
            <DisconnectHarness count={count} />
          </WalletProvider>
        </PollarProvider>
      )
    }

    function DisconnectHarness({ count }: { count: number }) {
      const { disconnect, isConnected } = useWalletContext()
      triggerDisconnect = disconnect
      return (
        <div data-testid="rerender-probe">
          renders={count};connected={String(isConnected)}
        </div>
      )
    }

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <AppProviders
          locale="en"
          navAuth={{
            user: currentAuthUser,
            profile: { id: 'user-stable', user_type: 'investor' } as never,
          }}
        >
          <ReRenderHarness />
        </AppProviders>,
      )
    })

    await waitFor(() => expect(profileUpdates.length).toBe(1))

    await act(async () => {
      bumpRender()
    })
    await act(async () => {
      bumpRender()
    })
    await act(async () => {
      bumpRender()
    })
    expect(profileUpdates.length).toBe(1)

    // Simulate synchronous no-op SDK logout that leaves SDK session intact; verify session never resurrects
    const fetchCalls: string[] = []
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      fetchCalls.push(String(input))
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    pollarMockState.logoutImpl = () => undefined

    currentAuthUser = null
    await act(async () => {
      await triggerDisconnect()
    })
    expect(view.getByTestId('rerender-probe').textContent).toContain('connected=false')
    expect(fetchCalls.some((u) => u.includes('/api/auth/pollar-sync'))).toBe(false)
    cleanup()

    // Verify NavAuthProvider sets ready=false while a newly signed-in user's profile is loading so UserTypeGate does not redirect prematurely
    activePathname = '/deals/1'
    routerReplaceCalls.length = 0
    pendingProfilePromiseMode = true

    await act(async () => {
      render(
        <AppProviders locale="en" navAuth={{ user: null, profile: null }}>
          <UserTypeGate />
        </AppProviders>,
      )
    })

    await act(async () => {
      for (const listener of authStateListeners) {
        listener('SIGNED_IN', { user: { id: 'returning-investor', email: 'inv@test.com' } })
      }
    })

    expect(routerReplaceCalls).toHaveLength(0)

    await act(async () => {
      resolvePendingProfile?.({ id: 'returning-investor', user_type: 'investor' })
    })
    expect(routerReplaceCalls).toHaveLength(0)
  })

  it('clears persisted mercato_wallet, pollar:*, and @StellarWalletsKit/* storage keys on signOutApp even when WalletProvider is unmounted', async () => {
    globalThis.fetch = mock(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch

    const { registerActiveWalletKitDisconnect } = await import('@/lib/wallet/session-cleanup')
    const { signOutApp } = await import('@/lib/auth/sign-out-app')

    const disconnectSpy = mock(async () => undefined)
    registerActiveWalletKitDisconnect(disconnectSpy)

    window.localStorage.setItem(
      'mercato_wallet',
      JSON.stringify({ provider: 'pollar', publicKey: 'GABC123', isEmbedded: true }),
    )
    window.localStorage.setItem('mercato_wallet_owner', 'user-a')
    window.localStorage.setItem('pollar:abc123:session', '{"token":{"accessToken":"tok"}}')
    window.localStorage.setItem('pollar:abc123:walletType', 'internal')
    window.localStorage.setItem('@StellarWalletsKit/usedWalletsIds', '["freighter"]')
    window.localStorage.setItem('theme', 'dark')

    await signOutApp()

    expect(disconnectSpy).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('mercato_wallet')).toBeNull()
    expect(window.localStorage.getItem('mercato_wallet_owner')).toBeNull()
    expect(window.localStorage.getItem('pollar:abc123:session')).toBeNull()
    expect(window.localStorage.getItem('pollar:abc123:walletType')).toBeNull()
    expect(window.localStorage.getItem('@StellarWalletsKit/usedWalletsIds')).toBeNull()
    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(signOutMock).toHaveBeenCalled()
  })
  it('[v5 P0-1] wipes pollar:* and IndexedDB pollar-keys on Render 1 owner mismatch and blocks late async @pollar/react hydration from leaking or overwriting Account B profile', async () => {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = 'pk_test_v5_p01'
    pollarMockState.enabled = true
    // Render 1: @pollar/react has NOT hydrated yet (isAuthenticated=false, verified=false)
    pollarMockState.isAuthenticated = false
    pollarMockState.verified = false
    pollarMockState.walletObj = null

    const deletedDbs: string[] = []
    const origIndexedDb = Object.getOwnPropertyDescriptor(window, 'indexedDB')
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      writable: true,
      value: {
        deleteDatabase: (name: string) => {
          deletedDbs.push(name)
          return {}
        },
      },
    })

    try {
      window.localStorage.setItem('mercato_wallet_owner', 'user-a')
      window.localStorage.setItem('pollar:test:session', 'secret-a')
      window.localStorage.setItem(
        'mercato_wallet',
        JSON.stringify({
          provider: 'pollar',
          publicKey: 'GPOLLARASYNCUSERA111111111111111111111111111111111111111',
          isEmbedded: true,
        }),
      )
      currentAuthUser = { id: 'user-b', email: 'b@test.com' }

      const { AppProviders } = await loadAppProviders()
      const { PollarProvider } = await import('@/providers/pollar-provider')
      const { WalletProvider, useWalletContext } = await import('@/providers/wallet-provider')

      let triggerHydrationRerender!: () => void

      function AsyncHydrationProbe() {
        const { publicKey, canSignTransactions, isConnected } = useWalletContext()
        return (
          <div data-testid="p01-probe">
            key={publicKey ?? 'NONE'};sign={String(canSignTransactions)};connected={String(isConnected)}
          </div>
        )
      }

      function AsyncHydrationHarness() {
        const [, setTick] = useState(0)
        triggerHydrationRerender = () => setTick((t) => t + 1)
        return (
          <PollarProvider>
            <WalletProvider>
              <AsyncHydrationProbe />
            </WalletProvider>
          </PollarProvider>
        )
      }

      let view!: ReturnType<typeof render>
      await act(async () => {
        view = render(
          <AppProviders locale="en" navAuth={{ user: currentAuthUser, profile: null }}>
            <AsyncHydrationHarness />
          </AppProviders>,
        )
      })

      // Render 1 must synchronously wipe pollar:*, mercato_wallet_owner, mercato_wallet, and pollar-keys
      expect(window.localStorage.getItem('pollar:test:session')).toBeNull()
      expect(window.localStorage.getItem('mercato_wallet_owner')).toBeNull()
      expect(window.localStorage.getItem('mercato_wallet')).toBeNull()
      expect(deletedDbs).toContain('pollar-keys')
      expect(view.getByTestId('p01-probe').textContent).toBe(
        'key=NONE;sign=false;connected=false',
      )

      // Render 2: @pollar/react asynchronously hydrates Account A's in-flight wallet session
      pollarMockState.isAuthenticated = true
      pollarMockState.verified = true
      pollarMockState.walletObj = {
        address: 'GPOLLARASYNCUSERA111111111111111111111111111111111111111',
        provisioning: 'READY',
      }
      pollarMockState.accessToken = 'pollar-async-token-a'

      await act(async () => {
        triggerHydrationRerender()
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(view.getByTestId('p01-probe').textContent).toBe(
        'key=NONE;sign=false;connected=false',
      )
      expect(pollarLogoutCalls).toBeGreaterThanOrEqual(1)
      expect(window.localStorage.getItem('pollar:test:session')).toBeNull()
      expect(
        profileUpdates.some(
          (u) =>
            u.id === 'user-b' &&
            u.payload.stellar_public_key ===
              'GPOLLARASYNCUSERA111111111111111111111111111111111111111',
        ),
      ).toBe(false)
      cleanup()

      // Also verify NavAuthProvider first SIGNED_IN (previousId === null) wipes mismatched stored owner
      const { resetRevokedPollarSessions } = await import('@/lib/wallet/session-cleanup')
      resetRevokedPollarSessions()
      window.localStorage.setItem('mercato_wallet_owner', 'user-a')
      window.localStorage.setItem('pollar:first-signin:session', 'secret-a-2')

      await act(async () => {
        render(
          <AppProviders locale="en" navAuth={{ user: null, profile: null }}>
            <div>anon</div>
          </AppProviders>,
        )
      })

      await act(async () => {
        for (const listener of authStateListeners) {
          listener('SIGNED_IN', { user: { id: 'user-b', email: 'b@test.com' } })
        }
      })

      expect(window.localStorage.getItem('mercato_wallet_owner')).toBeNull()
      expect(window.localStorage.getItem('pollar:first-signin:session')).toBeNull()
    } finally {
      if (origIndexedDb) {
        Object.defineProperty(window, 'indexedDB', origIndexedDb)
      } else {
        delete (window as unknown as Record<string, unknown>).indexedDB
      }
    }
  })

  it('[v5 P0-2] completes clearPersistedWalletSessions, signOutApp, and disconnect within bounded time when Pollar SDK logout() returns a permanently hung Promise', async () => {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = 'pk_test_v5_p02'
    pollarMockState.enabled = true
    pollarMockState.isAuthenticated = true
    pollarMockState.verified = true
    pollarMockState.walletObj = {
      address: 'GPOLLARHUNGLOGOUT111111111111111111111111111111111111111',
      provisioning: 'READY',
    }
    pollarMockState.accessToken = 'pollar-hung-token-1'
    // Permanently hanging Promise that never resolves or rejects
    pollarMockState.logoutImpl = () => new Promise<void>(() => {})
    currentAuthUser = { id: 'user-hung', email: 'hung@test.com' }

    const fetchRequests: Array<{ url: string; method?: string }> = []
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchRequests.push({ url: String(input), method: init?.method })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    const { clearPersistedWalletSessions } = await import('@/lib/wallet/session-cleanup')
    const { signOutApp } = await import('@/lib/auth/sign-out-app')
    const { AppProviders } = await loadAppProviders()
    const { PollarProvider } = await import('@/providers/pollar-provider')
    const { WalletProvider, useWalletContext } = await import('@/providers/wallet-provider')

    let triggerDisconnect!: () => Promise<void>

    function HungLogoutProbe() {
      const { disconnect, isConnected, publicKey } = useWalletContext()
      triggerDisconnect = disconnect
      return (
        <div data-testid="p02-probe">
          connected={String(isConnected)};key={publicKey ?? 'NONE'}
        </div>
      )
    }

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <AppProviders
          locale="en"
          navAuth={{
            user: currentAuthUser,
            profile: { id: 'user-hung', user_type: 'investor' } as never,
          }}
        >
          <PollarProvider>
            <WalletProvider>
              <HungLogoutProbe />
            </WalletProvider>
          </PollarProvider>
        </AppProviders>,
      )
    })

    expect(view.getByTestId('p02-probe').textContent).toContain('connected=true')

    // 1. Direct clearPersistedWalletSessions({ timeoutMs: 30 }) must clear storage synchronously and resolve promptly
    window.localStorage.setItem('mercato_wallet_owner', 'user-hung')
    window.localStorage.setItem('pollar:hung:session', 'secret-hung')
    const t0 = Date.now()
    await act(async () => {
      await clearPersistedWalletSessions({ timeoutMs: 30 })
    })
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(window.localStorage.getItem('mercato_wallet_owner')).toBeNull()
    expect(window.localStorage.getItem('pollar:hung:session')).toBeNull()
    expect(view.getByTestId('p02-probe').textContent).toBe('connected=false;key=NONE')

    // 2. signOutApp({ timeoutMs: 30 }) must not deadlock and must invoke POST /auth/sign-out and supabase.auth.signOut()
    window.localStorage.setItem('pollar:hung:session2', 'secret-hung-2')
    const t1 = Date.now()
    await act(async () => {
      await signOutApp({ timeoutMs: 30 })
    })
    expect(Date.now() - t1).toBeLessThan(1000)
    expect(window.localStorage.getItem('pollar:hung:session2')).toBeNull()
    expect(
      fetchRequests.some((r) => r.url === '/auth/sign-out' && r.method === 'POST'),
    ).toBe(true)
    expect(signOutMock).toHaveBeenCalled()

    // 3. Re-mount with a fresh hung Pollar session and verify disconnect() resolves in bounded time and never resurrects
    cleanup()
    const { resetRevokedPollarSessions } = await import('@/lib/wallet/session-cleanup')
    resetRevokedPollarSessions()
    fetchRequests.length = 0
    signOutMock.mockClear()

    await act(async () => {
      view = render(
        <AppProviders
          locale="en"
          navAuth={{
            user: currentAuthUser,
            profile: { id: 'user-hung', user_type: 'investor' } as never,
          }}
        >
          <PollarProvider>
            <WalletProvider>
              <HungLogoutProbe />
            </WalletProvider>
          </PollarProvider>
        </AppProviders>,
      )
    })
    expect(view.getByTestId('p02-probe').textContent).toContain('connected=true')

    window.localStorage.setItem('pollar:hung:session3', 'secret-hung-3')
    const t2 = Date.now()
    await act(async () => {
      await triggerDisconnect()
    })
    expect(Date.now() - t2).toBeLessThan(3500)
    expect(window.localStorage.getItem('pollar:hung:session3')).toBeNull()
    expect(
      fetchRequests.some((r) => r.url === '/auth/sign-out' && r.method === 'POST'),
    ).toBe(true)
    expect(signOutMock).toHaveBeenCalled()
    expect(view.getByTestId('p02-probe').textContent).toBe('connected=false;key=NONE')

    // Remounting while SDK memory still holds the hung session must never resurrect it
    cleanup()
    let remount!: ReturnType<typeof render>
    await act(async () => {
      remount = render(
        <AppProviders
          locale="en"
          navAuth={{
            user: currentAuthUser,
            profile: { id: 'user-hung', user_type: 'investor' } as never,
          }}
        >
          <PollarProvider>
            <WalletProvider>
              <HungLogoutProbe />
            </WalletProvider>
          </PollarProvider>
        </AppProviders>,
      )
    })
    expect(remount.getByTestId('p02-probe').textContent).toBe('connected=false;key=NONE')
  })

  it('[v5 P1-1 & P2-1] avoids extra getUser()/onAuthStateChange during NavAuth ready transitions and drops stale NotificationsProvider.refresh() responses across account switches', async () => {
    type NotificationRecord = {
      id: string
      user_id: string
      type: string
      title: string
      body: string | null
      link: string | null
      read_at: string | null
      created_at: string
    }

    let resolveStaleRefreshA: ((items: NotificationRecord[]) => void) | null = null
    let userAFetchCount = 0

    const notifA1: NotificationRecord = {
      id: 'notif-a-initial',
      user_id: 'user-a',
      type: 'deal_funded',
      title: 'Account A Initial',
      body: null,
      link: null,
      read_at: null,
      created_at: '2026-11-20T00:00:00.000Z',
    }
    const notifAStale: NotificationRecord = {
      id: 'notif-a-stale',
      user_id: 'user-a',
      type: 'deal_funded',
      title: 'Account A Stale Refresh',
      body: null,
      link: null,
      read_at: null,
      created_at: '2026-11-20T00:01:00.000Z',
    }
    const notifB1: NotificationRecord = {
      id: 'notif-b-fresh',
      user_id: 'user-b',
      type: 'deal_funded',
      title: 'Account B Fresh',
      body: null,
      link: null,
      read_at: null,
      created_at: '2026-11-20T00:02:00.000Z',
    }

    mock.module('@/lib/client/notifications-cache', () => ({
      ...NotificationsCacheOriginal,
      notificationsRequest: {
        ...NotificationsCacheOriginal.notificationsRequest,
        fetch: (uid: string) => {
          if (uid === 'user-a') {
            userAFetchCount += 1
            if (userAFetchCount === 1) {
              return Promise.resolve([notifA1])
            }
            return new Promise<NotificationRecord[]>((res) => {
              resolveStaleRefreshA = res
            })
          }
          if (uid === 'user-b') {
            return Promise.resolve([notifB1])
          }
          return Promise.resolve([])
        },
        invalidate: () => undefined,
      },
    }))

    pendingProfilePromiseMode = true

    const { AppProviders } = await loadAppProviders()
    const { NotificationsProvider, useNotifications } = await import(
      '@/components/notifications/notifications-provider'
    )

    let triggerRefresh!: () => Promise<void>

    function NotificationsProbe() {
      const { notifications, isLoading, refresh } = useNotifications()
      triggerRefresh = refresh
      return (
        <div data-testid="notif-probe">
          loading={String(isLoading)};ids={notifications.map((n) => n.id).join(',') || 'NONE'}
        </div>
      )
    }

    // Mount with NavAuthProvider ready=true (anonymous), then transition ready: true -> false -> true
    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <AppProviders locale="en" navAuth={{ user: null, profile: null }}>
          <NotificationsProvider>
            <NotificationsProbe />
          </NotificationsProvider>
        </AppProviders>,
      )
    })

    // Only NavAuthProvider itself should subscribe to onAuthStateChange (1 call total), 0 getUser calls
    expect(getUserMock).toHaveBeenCalledTimes(0)
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1)

    // Sign in Account A: NavAuthProvider enters ready=false while profile loads
    await act(async () => {
      for (const listener of authStateListeners) {
        listener('SIGNED_IN', { user: { id: 'user-a', email: 'a@test.com' } })
      }
    })

    // During ready=false transition, NotificationsProvider must NOT call getUser() or add a second onAuthStateChange listener
    expect(getUserMock).toHaveBeenCalledTimes(0)
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('notif-probe').textContent).toBe('loading=true;ids=NONE')

    // Complete Account A profile load -> ready=true
    await act(async () => {
      resolvePendingProfile?.({ id: 'user-a', user_type: 'investor' })
    })

    await waitFor(() =>
      expect(view.getByTestId('notif-probe').textContent).toBe(
        'loading=false;ids=notif-a-initial',
      ),
    )
    expect(getUserMock).toHaveBeenCalledTimes(0)
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1)

    // P2-1: Trigger manual refresh() for Account A (stays pending), then switch to Account B
    let pendingRefreshPromise!: Promise<void>
    await act(async () => {
      pendingRefreshPromise = triggerRefresh()
    })
    expect(resolveStaleRefreshA).not.toBeNull()

    // Switch account to Account B while Account A's refresh() is still in flight
    await act(async () => {
      for (const listener of authStateListeners) {
        listener('SIGNED_IN', { user: { id: 'user-b', email: 'b@test.com' } })
      }
    })
    expect(getUserMock).toHaveBeenCalledTimes(0)
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePendingProfile?.({ id: 'user-b', user_type: 'investor' })
    })

    await waitFor(() =>
      expect(view.getByTestId('notif-probe').textContent).toBe(
        'loading=false;ids=notif-b-fresh',
      ),
    )

    // Now resolve Account A's late refresh() response — must be discarded and NOT overwrite Account B's bucket
    await act(async () => {
      resolveStaleRefreshA?.([notifAStale])
      await pendingRefreshPromise
    })

    expect(view.getByTestId('notif-probe').textContent).toBe(
      'loading=false;ids=notif-b-fresh',
    )
  })

  it('[v6 P0-1] refreshes PollarSessionBridge session across Pollar v3 optimistic resume (verified: false -> true) and silent background token rotation so /api/auth/pollar-sync never sends an expired accessToken', async () => {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = 'pk_test_v6_p01'
    activePathname = '/auth/login'
    currentAuthUser = null

    // Frame 1: Pollar v3 optimistic restore from storage with an expired accessToken (`verified: false`)
    pollarMockState.enabled = true
    pollarMockState.isAuthenticated = true
    pollarMockState.verified = false
    pollarMockState.walletObj = {
      address: 'GPOLLARRESUME1111111111111111111111111111111111111111111',
      provisioning: 'READY',
    }
    pollarMockState.accessToken = 'expired-optimistic-token'

    const syncedAccessTokens: string[] = []
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/auth/pollar-sync') {
        const parsed = JSON.parse(String(init?.body ?? '{}')) as { accessToken?: string }
        syncedAccessTokens.push(parsed.accessToken ?? '')
        if (parsed.accessToken === 'expired-optimistic-token') {
          return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401 })
        }
        return new Response(JSON.stringify({ token_hash: 'otp-hash-v6' }), { status: 200 })
      }
      return new Response(JSON.stringify({ balances: [] }), { status: 200 })
    }) as unknown as typeof fetch

    const { AppProviders } = await loadAppProviders()
    const { PollarProvider, usePollarSession } = await import('@/providers/pollar-provider')
    const { WalletProvider } = await import('@/providers/wallet-provider')

    let rerenderTick!: () => void
    function TokenProbe() {
      const { session, verified } = usePollarSession()
      return (
        <div data-testid="v6-token-probe">
          verified={String(verified)};token={session?.token?.accessToken ?? 'NONE'}
        </div>
      )
    }
    function ResumeHarness() {
      const [, setTick] = useState(0)
      rerenderTick = () => setTick((n) => n + 1)
      return (
        <PollarProvider>
          <WalletProvider>
            <TokenProbe />
          </WalletProvider>
        </PollarProvider>
      )
    }

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <AppProviders locale="en" navAuth={{ user: null, profile: null }}>
          <ResumeHarness />
        </AppProviders>,
      )
    })
    expect(view.getByTestId('v6-token-probe').textContent).toBe(
      'verified=false;token=expired-optimistic-token',
    )
    expect(syncedAccessTokens).toHaveLength(0)

    // Frame 2: PollarClient._doResume() refreshes the expired token and flips verified=true while sdkIsAuthenticated stays true
    pollarMockState.accessToken = 'refreshed-live-token-v6'
    pollarMockState.verified = true
    await act(async () => {
      emitPollarAuthStateChange()
      rerenderTick()
    })

    await waitFor(() => expect(syncedAccessTokens.length).toBeGreaterThanOrEqual(1))
    expect(view.getByTestId('v6-token-probe').textContent).toBe(
      'verified=true;token=refreshed-live-token-v6',
    )
    expect(syncedAccessTokens).toEqual(['refreshed-live-token-v6'])

    // Frame 3: Silent background token refresh via client.onAuthStateChange without any React prop change
    currentAuthUser = { id: 'pollar-user-v6', email: 'a@test.com' }
    pollarMockState.accessToken = 'rotated-proactive-token-v6'
    await act(async () => {
      emitPollarAuthStateChange()
    })
    expect(view.getByTestId('v6-token-probe').textContent).toBe(
      'verified=true;token=rotated-proactive-token-v6',
    )
  })

  it('[v6 P0-2] preserves newly connected Pollar and external wallets when a stale mercato_wallet_owner from an expired prior cookie exists before SIGNED_IN', async () => {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = 'pk_test_v6_p02'
    activePathname = '/auth/login'
    currentAuthUser = null

    // Prior user-a cookie expired naturally, leaving stale mercato_wallet_owner in localStorage
    window.localStorage.setItem('mercato_wallet_owner', 'user-a')

    pollarMockState.enabled = true
    pollarMockState.isAuthenticated = false
    pollarMockState.verified = false
    pollarMockState.walletObj = null
    pollarMockState.openModalImpl = () => {
      // User B completes interactive Pollar login inside modal
      pollarMockState.isAuthenticated = true
      pollarMockState.verified = true
      pollarMockState.walletId = 'pollar-wallet-b'
      pollarMockState.userId = 'pollar-uid-b'
      pollarMockState.clientSessionId = 'pollar-csid-b'
      pollarMockState.accessToken = 'pollar-token-user-b'
      pollarMockState.walletObj = {
        address: 'GPOLLARNEWUSERB11111111111111111111111111111111111111111',
        provisioning: 'READY',
      }
      window.localStorage.setItem('pollar:user-b:session', 'active-b-session')
      emitPollarAuthStateChange()
    }

    const { AppProviders } = await loadAppProviders()
    const { AuthWalletProviders } = await import('@/components/providers/auth-wallet-providers')
    const { useWalletContext } = await import('@/providers/wallet-provider')

    let triggerConnectPollar!: () => Promise<void>
    let triggerConnectExternal!: () => Promise<void>

    function AuthConnectProbe() {
      const { connectPollarWallet, connectExternalWallet, isConnected, publicKey } =
        useWalletContext()
      triggerConnectPollar = connectPollarWallet
      triggerConnectExternal = connectExternalWallet
      return (
        <div data-testid="v6-p02-probe">
          connected={String(isConnected)};key={publicKey ?? 'NONE'}
        </div>
      )
    }

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <AppProviders locale="en" navAuth={{ user: null, profile: null }}>
          <AuthWalletProviders>
            <AuthConnectProbe />
          </AuthWalletProviders>
        </AppProviders>,
      )
    })

    // 1. User B clicks Continue with Pollar while unauthenticated, then verifyOtp triggers SIGNED_IN('user-b')
    await act(async () => {
      await triggerConnectPollar()
    })
    currentAuthUser = { id: 'user-b', email: 'b@mercato.test' }
    await act(async () => {
      for (const listener of authStateListeners) {
        listener('SIGNED_IN', { user: currentAuthUser })
      }
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(view.getByTestId('v6-p02-probe').textContent).toBe(
      'connected=true;key=GPOLLARNEWUSERB11111111111111111111111111111111111111111',
    )
    expect(window.localStorage.getItem('pollar:user-b:session')).toBe('active-b-session')
    await waitFor(() =>
      expect(window.localStorage.getItem('mercato_wallet_owner')).toBe('user-b'),
    )
    cleanup()

    // 2. Same scenario on /auth/sign-up when User C connects an external Stellar wallet before SIGNED_IN('user-c')
    const { resetStellarWalletKit } = await import('@/lib/trustless/lazy-wallet-kit')
    const { resetRevokedPollarSessions } = await import('@/lib/wallet/session-cleanup')
    resetStellarWalletKit()
    resetRevokedPollarSessions()
    pollarMockState.enabled = false
    currentAuthUser = null
    window.localStorage.setItem('mercato_wallet_owner', 'user-a')

    mock.module('@creit.tech/stellar-wallets-kit', () => ({
      StellarWalletsKit: class {
        openModal({
          onWalletSelected,
        }: {
          onWalletSelected: (opt: { id: string; name: string }) => Promise<void>
        }) {
          return onWalletSelected({ id: 'freighter', name: 'Freighter' })
        }
        setWallet() {}
        async getAddress() {
          return { address: 'GFREIGHTERNEWUSERC11111111111111111111111111111111111111' }
        }
        async signTransaction() {
          return { signedTxXdr: 'XDR' }
        }
        async disconnect() {}
      },
      WalletNetwork: { TESTNET: 'test', PUBLIC: 'public' },
      FREIGHTER_ID: 'freighter',
      AlbedoModule: class {},
      FreighterModule: class {},
    }))

    let viewExt!: ReturnType<typeof render>
    await act(async () => {
      viewExt = render(
        <AppProviders locale="en" navAuth={{ user: null, profile: null }}>
          <AuthWalletProviders>
            <AuthConnectProbe />
          </AuthWalletProviders>
        </AppProviders>,
      )
    })

    await act(async () => {
      await triggerConnectExternal()
    })
    currentAuthUser = { id: 'user-c', email: 'c@mercato.test' }
    await act(async () => {
      for (const listener of authStateListeners) {
        listener('SIGNED_IN', { user: currentAuthUser })
      }
    })

    await waitFor(() =>
      expect(window.localStorage.getItem('mercato_wallet_owner')).toBe('user-c'),
    )
    expect(viewExt.getByTestId('v6-p02-probe').textContent).toBe(
      'connected=true;key=GFREIGHTERNEWUSERC11111111111111111111111111111111111111',
    )
  })

  it('[v6 P1-1 & P2-1] allows same-tab Pollar logout followed by re-login (including token reuse, address fallback, and hung-logout modal swap) and releases SWK singleton immediately on hung disconnect', async () => {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = 'pk_test_v6_p11'
    pollarMockState.enabled = true
    pollarMockState.isAuthenticated = true
    pollarMockState.verified = true
    pollarMockState.accessToken = undefined // Exercise `addr:<walletAddress>` fallback as well
    pollarMockState.walletObj = {
      address: 'GPOLLARSAMETAB111111111111111111111111111111111111111111',
      provisioning: 'READY',
    }
    currentAuthUser = { id: 'user-sametab', email: 'same@mercato.test' }

    const { AppProviders } = await loadAppProviders()
    const { PollarProvider, usePollarSession } = await import('@/providers/pollar-provider')
    const { WalletProvider, useWalletContext } = await import('@/providers/wallet-provider')

    let doLogout!: () => void
    let doOpenModal!: () => void
    let bump!: () => void

    function ReloginProbe() {
      const pollar = usePollarSession()
      const wallet = useWalletContext()
      doLogout = pollar.logout
      doOpenModal = pollar.openLoginModal
      return (
        <div data-testid="v6-relogin-probe">
          auth={String(pollar.isAuthenticated)};connected={String(wallet.isConnected)};key=
          {wallet.publicKey ?? 'NONE'}
        </div>
      )
    }
    function ReloginHarness() {
      const [, setTick] = useState(0)
      bump = () => setTick((n) => n + 1)
      return (
        <PollarProvider>
          <WalletProvider>
            <ReloginProbe />
          </WalletProvider>
        </PollarProvider>
      )
    }

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <AppProviders locale="en" navAuth={{ user: currentAuthUser, profile: null }}>
          <ReloginHarness />
        </AppProviders>,
      )
    })
    expect(view.getByTestId('v6-relogin-probe').textContent).toBe(
      'auth=true;connected=true;key=GPOLLARSAMETAB111111111111111111111111111111111111111111',
    )

    // 1. Normal logout clears sdkWallet to null (rawWalletAddress === ''), then user clicks openLoginModal and logs back in with the SAME wallet address
    await act(async () => {
      doLogout()
      emitPollarAuthStateChange()
      bump()
    })
    expect(view.getByTestId('v6-relogin-probe').textContent).toBe(
      'auth=false;connected=false;key=NONE',
    )

    pollarMockState.openModalImpl = () => {
      pollarMockState.isAuthenticated = true
      pollarMockState.verified = true
      pollarMockState.walletObj = {
        address: 'GPOLLARSAMETAB111111111111111111111111111111111111111111',
        provisioning: 'READY',
      }
      emitPollarAuthStateChange()
    }
    await act(async () => {
      doOpenModal()
      bump()
    })
    expect(view.getByTestId('v6-relogin-probe').textContent).toBe(
      'auth=true;connected=true;key=GPOLLARSAMETAB111111111111111111111111111111111111111111',
    )
    cleanup()

    // 2. Verify SWK singleton is cleared immediately when disconnect() hangs past timeout
    let swkInstancesCreated = 0
    mock.module('@creit.tech/stellar-wallets-kit', () => ({
      StellarWalletsKit: class {
        constructor() {
          swkInstancesCreated += 1
        }
        disconnect() {
          return new Promise<void>(() => {})
        }
      },
      WalletNetwork: { TESTNET: 'test', PUBLIC: 'public' },
      FREIGHTER_ID: 'freighter',
      AlbedoModule: class {},
      FreighterModule: class {},
    }))

    const { getStellarWalletKit, isStellarWalletKitInitialized } = await import(
      '@/lib/trustless/lazy-wallet-kit'
    )
    const { clearPersistedWalletSessions } = await import('@/lib/wallet/session-cleanup')

    await getStellarWalletKit()
    expect(swkInstancesCreated).toBe(1)
    expect(isStellarWalletKitInitialized()).toBe(true)

    await clearPersistedWalletSessions({ timeoutMs: 20 })
    expect(isStellarWalletKitInitialized()).toBe(false)
  })

  it('[v6.1 P1-1 & P1-2] preserves in-flight pollar-sync across CREATING -> READY wallet provisioning, blocks modal-cancel refresh bypass of quarantined hung sessions, and keeps csid-revoked sessions disconnected across slow-logout token rotation', async () => {
    process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY = 'pk_test_v61_pollar'
    activePathname = '/auth/sign-up'
    currentAuthUser = null

    const { AppProviders } = await loadAppProviders()
    const { AuthWalletProviders } = await import('@/components/providers/auth-wallet-providers')
    const { usePollarSession } = await import('@/providers/pollar-provider')
    const { useWalletContext } = await import('@/providers/wallet-provider')

    let resolveSyncFetch!: () => void
    let syncFetchCalls = 0
    const routerPushCalls: string[] = []
    const customRouter = {
      ...stableRouter,
      push: (href: string) => {
        routerPushCalls.push(href)
      },
    }
    mock.module('next/navigation', () => ({
      ...NextNavigationOriginal,
      useRouter: () => customRouter,
      usePathname: () => activePathname,
      useParams: () => activeParams,
      useSearchParams: () => stableSearchParams,
    }))

    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/auth/pollar-sync') {
        syncFetchCalls += 1
        return new Promise<Response>((res) => {
          resolveSyncFetch = () =>
            res(
              new Response(JSON.stringify({ token_hash: 'new-pollar-signup-hash' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
        })
      }
      return Promise.resolve(
        new Response(JSON.stringify({ balances: [{ asset_type: 'native', balance: '10.00' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }) as unknown as typeof fetch

    try {
      // --- Part 1 ([P1-1]): New Pollar signup starts with provisioning: 'CREATING' and transitions to 'READY' while /api/auth/pollar-sync is in flight ---
      pollarMockState.enabled = true
      pollarMockState.isAuthenticated = true
      pollarMockState.verified = true
      pollarMockState.userId = 'pollar-new-signup-uid'
      pollarMockState.clientSessionId = 'pollar-new-signup-csid'
      pollarMockState.accessToken = 'pollar-new-signup-token'
      pollarMockState.walletObj = {
        address: 'GPOLLARNEWSIGNUP11111111111111111111111111111111111111111',
        provisioning: 'CREATING',
      }

      let doOpenModal!: () => void
      let doDisconnect!: () => Promise<void>
      function V61Probe() {
        const pollar = usePollarSession()
        const wallet = useWalletContext()
        doOpenModal = pollar.openLoginModal
        doDisconnect = wallet.disconnect
        return (
          <div data-testid="v61-probe">
            auth={String(pollar.isAuthenticated)};connected={String(wallet.isConnected)};canSign=
            {String(wallet.canSignTransactions)};key={wallet.publicKey ?? 'NONE'}
          </div>
        )
      }

      let signupView!: ReturnType<typeof render>
      await act(async () => {
        signupView = render(
          <AppProviders locale="en" navAuth={{ user: null, profile: null }}>
            <AuthWalletProviders>
              <V61Probe />
            </AuthWalletProviders>
          </AppProviders>,
        )
      })

      await waitFor(() => expect(syncFetchCalls).toBe(1))
      expect(signupView.getByTestId('v61-probe').textContent).toContain('canSign=false')

      // While /api/auth/pollar-sync is still awaiting response, Pollar SDK completes account creation ('CREATING' -> 'READY')
      await act(async () => {
        pollarMockState.walletObj = {
          address: 'GPOLLARNEWSIGNUP11111111111111111111111111111111111111111',
          provisioning: 'READY',
        }
        emitPollarAuthStateChange()
      })
      expect(signupView.getByTestId('v61-probe').textContent).toContain('canSign=true')

      // Now /api/auth/pollar-sync resolves -> must NOT have been aborted/deadlocked; verifyOtp + router.push must complete!
      await act(async () => {
        resolveSyncFetch()
      })
      await waitFor(() => expect(routerPushCalls.length).toBe(1))
      cleanup()

      // --- Part 2 ([P1-2a]): Account A hung logout + Account B opens & cancels <LoginModal> + Account A background token refresh ---
      const { resetRevokedPollarSessions } = await import('@/lib/wallet/session-cleanup')
      resetRevokedPollarSessions()
      profileUpdates.length = 0
      activePathname = '/dashboard/wallets'
      currentAuthUser = { id: 'user-b-victim', email: 'b@mercato.test' }
      window.localStorage.setItem('mercato_wallet_owner', 'user-a-hung')

      pollarMockState.enabled = true
      pollarMockState.isAuthenticated = true
      pollarMockState.verified = true
      pollarMockState.userId = 'pollar-uid-a-hung'
      pollarMockState.clientSessionId = 'pollar-csid-a-hung'
      pollarMockState.accessToken = 'tok-a-hung-1'
      pollarMockState.walletObj = {
        address: 'GPOLLARACCOUNTAHUNG11111111111111111111111111111111111111',
        provisioning: 'READY',
      }
      // Hung logout never clears SDK memory
      pollarMockState.logoutImpl = () => new Promise<void>(() => {})
      // <LoginModal> mounts and replays the hung 'authenticated' state, then user closes modal without logging in
      pollarMockState.openModalImpl = () => {
        emitPollarAuthStateChange()
      }

      let bView!: ReturnType<typeof render>
      await act(async () => {
        bView = render(
          <AppProviders locale="en" navAuth={{ user: currentAuthUser, profile: null }}>
            <AuthWalletProviders>
              <V61Probe />
            </AuthWalletProviders>
          </AppProviders>,
        )
      })
      expect(bView.getByTestId('v61-probe').textContent).toBe(
        'auth=false;connected=false;canSign=false;key=NONE',
      )

      // Account B opens and cancels <LoginModal>, then Account A's hung session silently rotates accessToken on same clientSessionId
      await act(async () => {
        doOpenModal()
      })
      await act(async () => {
        pollarMockState.accessToken = 'tok-a-hung-2-rotated'
        emitPollarAuthStateChange()
      })
      expect(bView.getByTestId('v61-probe').textContent).toBe(
        'auth=false;connected=false;canSign=false;key=NONE',
      )
      expect(profileUpdates.filter((u) => u.id === 'user-b-victim')).toHaveLength(0)
      cleanup()

      // --- Part 3 ([P1-2b]): Slow POST /auth/logout rotates accessToken on same clientSessionId after disconnect() timeout ---
      resetRevokedPollarSessions()
      syncFetchCalls = 0
      activePathname = '/deals/deal-1'
      currentAuthUser = { id: 'user-slow-logout', email: 'slow@mercato.test' }
      pollarMockState.userId = 'pollar-uid-slow'
      pollarMockState.clientSessionId = 'pollar-csid-slow'
      pollarMockState.accessToken = 'tok-slow-1'
      pollarMockState.walletObj = {
        address: 'GPOLLARSLOWLOGOUT1111111111111111111111111111111111111111',
        provisioning: 'READY',
      }
      pollarMockState.logoutImpl = () => new Promise<void>(() => {})

      let slowView!: ReturnType<typeof render>
      await act(async () => {
        slowView = render(
          <AppProviders locale="en" navAuth={{ user: currentAuthUser, profile: null }}>
            <AuthWalletProviders>
              <V61Probe />
            </AuthWalletProviders>
          </AppProviders>,
        )
      })
      expect(slowView.getByTestId('v61-probe').textContent).toContain('connected=true')

      // User clicks disconnect -> times out waiting on hung sdkLogout and signs out of Supabase (currentAuthUser = null)
      signOutMock.mockImplementationOnce(async () => {
        currentAuthUser = null
        for (const listener of authStateListeners) {
          listener('SIGNED_OUT', null)
        }
        return { error: null }
      })
      await act(async () => {
        await doDisconnect()
      })
      expect(slowView.getByTestId('v61-probe').textContent).toBe(
        'auth=false;connected=false;canSign=false;key=NONE',
      )

      // In-flight refresh on the same clientSessionId rotates accessToken before POST /auth/logout finishes -> must NOT resurrect or call pollar-sync!
      await act(async () => {
        pollarMockState.accessToken = 'tok-slow-2-rotated'
        emitPollarAuthStateChange()
      })
      expect(slowView.getByTestId('v61-probe').textContent).toBe(
        'auth=false;connected=false;canSign=false;key=NONE',
      )
      expect(syncFetchCalls).toBe(0)
    } finally {
      mock.module('next/navigation', () => ({
        ...NextNavigationOriginal,
        useRouter: () => stableRouter,
        usePathname: () => activePathname,
        useParams: () => activeParams,
        useSearchParams: () => stableSearchParams,
      }))
    }
  }, 20_000)
})
