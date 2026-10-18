import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import * as nextNavigation from 'next/navigation'
import * as supabaseServer from '@/lib/supabase/server'

// Bun's mock.restore() does not undo mock.module(); fall through to the real exports afterwards.
const real = { redirect: nextNavigation.redirect, createClient: supabaseServer.createClient }

class RedirectCalled extends Error {
  constructor(readonly url: string) {
    super(`redirect(${url})`)
  }
}

const state = {
  active: true,
  user: null as { id: string } | null,
  profile: null as { user_type: string | null } | null,
}

// The real getDashboardSession runs against this fake client.
const client = {
  auth: { getUser: async () => ({ data: { user: state.user } }) },
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
  createClient: async () => (state.active ? client : real.createClient()),
}))

// Keep every real export so later test files still find usePathname etc.
mock.module('next/navigation', () => ({
  ...nextNavigation,
  redirect: (url: string) => {
    if (!state.active) return real.redirect(url)
    throw new RedirectCalled(url)
  },
}))

const { default: DashboardLayout } = await import('@/app/dashboard/layout')
const { ONBOARDING_SETTINGS_PATH } = await import('@/lib/profile/onboarding')

beforeEach(() => {
  state.user = null
  state.profile = null
})

afterAll(() => {
  state.active = false
})

test('redirects a signed-out visitor to login', async () => {
  const error = await DashboardLayout({ children: null }).catch((e) => e)
  expect((error as RedirectCalled).url).toBe('/auth/login')
})

test('sends a user without a role to onboarding', async () => {
  state.user = { id: 'user-1' }
  state.profile = { user_type: null }
  const error = await DashboardLayout({ children: null }).catch((e) => e)
  expect((error as RedirectCalled).url).toBe(ONBOARDING_SETTINGS_PATH)
})

test('renders the shell for the signed-in role', async () => {
  state.user = { id: 'user-1' }
  state.profile = { user_type: 'investor' }
  const element = (await DashboardLayout({ children: null })) as { props: Record<string, unknown> }
  expect(element.props.userType).toBe('investor')
})
