import type { SupabaseClient } from '@supabase/supabase-js'
import { NAV_PROFILE_COLUMNS } from '@/lib/navigation/nav-auth'
import type { NavProfile } from '@/components/navigation/user-nav-types'

/** How long a cached navigation profile is considered fresh. */
export const NAV_PROFILE_CACHE_TTL_MS = 30_000

interface CacheEntry {
  profile: NavProfile | null
  expiresAt: number
}

const profileCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<NavProfile | null>>()

/** Seed the cache with a server-resolved profile so hydration never refetches. */
export function primeNavProfile(userId: string, profile: NavProfile | null): void {
  profileCache.set(userId, { profile, expiresAt: Date.now() + NAV_PROFILE_CACHE_TTL_MS })
}

/** Drop cached navigation data for one user, or every user when omitted. */
export function invalidateNavProfile(userId?: string): void {
  if (userId) {
    profileCache.delete(userId)
    inflight.delete(userId)
    return
  }
  profileCache.clear()
  inflight.clear()
}

/**
 * Load the navigation profile projection for `userId`.
 *
 * Concurrent callers share a single in-flight request and a short-lived cache,
 * so the navigation, the user menu, and the onboarding gate never issue
 * duplicate `profiles` round trips for the same user.
 */
export function loadNavProfile(
  client: SupabaseClient,
  userId: string,
): Promise<NavProfile | null> {
  const cached = profileCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.profile)

  const pending = inflight.get(userId)
  if (pending) return pending

  const request = client
    .from('profiles')
    .select(NAV_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        console.error('[nav-auth] failed to load navigation profile', error)
        return cached?.profile ?? null
      }
      const profile = (data as NavProfile | null) ?? null
      primeNavProfile(userId, profile)
      return profile
    })
    .finally(() => {
      inflight.delete(userId)
    })

  inflight.set(userId, request)
  return request
}
