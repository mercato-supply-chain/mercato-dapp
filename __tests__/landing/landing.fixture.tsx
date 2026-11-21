import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import type { ReactNode } from 'react'

const scenario = process.argv[2]
const stats = {
  ordersFunded: 12, openForFunding: 3, activeSmes: 2, smesWithActiveDeals: 1,
  verifiedSuppliers: 4, supplierCountries: 2, capitalMobilized: 3000,
  capitalFundedThisMonth: 2000, capitalMonthGrowthPercent: 100,
}

if (scenario === 'stream') {
  const React = await import('react')
  const { renderToReadableStream } = await import('react-dom/server')
  let release!: (value: typeof stats) => void
  const pending = new Promise<typeof stats>((resolve) => { release = resolve })
  mock.module('@/lib/landing/get-platform-stats', () => ({ getLandingPlatformStats: () => pending }))
  const { enDict } = await import('@/lib/i18n/dictionaries')
  const { translate } = await import('@/lib/i18n/messages')
  mock.module('@/lib/i18n/provider', () => ({ useI18n: () => ({
    locale: 'en', t: (key: string, replacements?: Record<string, string | number>) => translate(enDict, enDict, key, replacements),
  }) }))
  mock.module('next/image', () => ({ default: () => null }))
  mock.module('next/link', () => ({ default: ({ children }: { children: ReactNode }) => <a>{children}</a> }))
  const sections = {
    '@/components/navigation': 'Navigation',
    '@/components/landing/landing-roles': 'LandingRoles',
    '@/components/landing/landing-rate-comparison': 'LandingRateComparison',
    '@/components/landing/landing-live-deals': 'LandingLiveDeals',
    '@/components/landing/landing-faq': 'LandingFaq',
    '@/components/landing/landing-page-intro': 'LandingPartnersStrip',
    '@/components/landing/landing-footer': 'LandingFooter',
    '@/components/landing/landing-hash-scroll': 'LandingHashScroll',
    '@/components/landing/hero-how-it-works-steps': 'HeroHowItWorksSteps',
  }
  for (const [path, name] of Object.entries(sections)) {
    mock.module(path, () => ({ [name]: () => <div>{name}</div> }))
  }
  const { default: HomePage } = await import('@/app/page')
  const page = HomePage()
  assert(!('then' in page), 'homepage itself must not await the stats')
  const stream = await renderToReadableStream(page)
  const reader = stream.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  const first = await Promise.race([
    reader.read(),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('shell blocked on stats')), 3000) }),
  ])
  clearTimeout(timer)
  const shell = new TextDecoder().decode(first.value)
  assert(shell.includes(translate(enDict, enDict, 'landing.hero.titleLine1')))
  assert(shell.includes('LandingRoles') && shell.includes('LandingFaq'))
  assert(shell.includes('aria-busy="true"'), 'stats skeleton should be in initial HTML')
  assert(!shell.includes('3 deals open'), 'real stats must still be pending')
  release(stats)
  let rest = ''
  for (;;) {
    const next = await reader.read()
    if (next.done) break
    rest += new TextDecoder().decode(next.value)
  }
  assert(rest.includes('aria-busy="false"'))
  assert(rest.includes('12'))
  assert(rest.includes(translate(enDict, enDict, 'landing.hero.stats.orders.deltaOpen', { count: 3 })))
  assert(rest.includes(translate(enDict, enDict, 'landing.hero.stats.capital.deltaGrowth', { percent: 100 })))
} else {
  const { createClient: realCreateClient } = await import('@supabase/supabase-js')
  const createCalls: unknown[][] = []
  let fetchCount = 0
  let fail = scenario === 'query-error'
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const responses = [
    { count: 12 }, { count: 3 }, { data: [{ pyme_id: 'a' }, { pyme_id: 'a' }, { pyme_id: 'b' }] },
    { data: [{ pyme_id: 'a' }] }, { count: 4 }, { data: [{ country: 'MX' }, { country: ' MX ' }, { country: 'US' }] },
    { data: [{ amount: '1000' }, { amount: 2000 }] },
    { data: [{ amount: '1000', funded_at: lastMonth }, { amount: 2000, funded_at: thisMonth }] },
  ]
  // Real Supabase query builders execute against a fake HTTP transport.
  mock.module('@supabase/supabase-js', () => ({ createClient: (...args: Parameters<typeof realCreateClient>) => {
    createCalls.push(args)
    return realCreateClient(args[0], args[1], { ...args[2], global: { fetch: Object.assign(async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const index = fetchCount++ % 8
      if (fail && index === 0) return new Response(JSON.stringify({ message: 'temporarily unavailable' }), { status: 400 })
      const result = responses[index]
      if (init?.method === 'HEAD') return new Response(null, { headers: { 'content-range': `0-0/${'count' in result ? result.count : 0}` } })
      return Response.json('data' in result ? result.data : [])
    }, { preconnect() {} }) } })
  } }))
  const configs: unknown[] = []
  mock.module('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>, keys: string[], options: unknown) => {
    configs.push({ keys, options })
    return fn
  } }))
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://landing-test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key'
  const { getLandingPlatformStats } = await import('@/lib/landing/get-platform-stats')
  if (fail) {
    const originalError = console.error
    console.error = () => {}
    try {
      assert.equal((await getLandingPlatformStats()).ordersFunded, 0)
    } finally { console.error = originalError }
    fail = false
  }
  assert.deepEqual(await getLandingPlatformStats(), stats)
  assert.deepEqual(configs, [{ keys: ['landing-platform-stats-v1'], options: { revalidate: 60 } }])
  assert.deepEqual((createCalls[0][2] as { auth: unknown }).auth, {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
  })
  assert.equal(createCalls[0][1], 'public-test-key')
  assert.equal(fetchCount, scenario === 'query-error' ? 16 : 8)
}
console.log('ok')
