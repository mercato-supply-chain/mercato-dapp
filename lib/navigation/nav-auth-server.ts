import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { NAV_PROFILE_COLUMNS, type NavAuthSnapshot } from '@/lib/navigation/nav-auth'
import type { NavProfile } from '@/components/navigation/user-nav-types'

/**
 * Resolve the initial navigation auth state on the server so the first paint
 * already knows the signed-in user and their navigation-sized profile.
 *
 * `cache` deduplicates the lookup across the render tree: every server
 * component that needs the navigation state shares one auth/profile read
 * instead of issuing its own post-hydration waterfall.
 */
export const getNavAuth = cache(async (): Promise<NavAuthSnapshot> => {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { user: null, profile: null }

    const { data } = await supabase
      .from('profiles')
      .select(NAV_PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle()

    return {
      user: { id: user.id, email: user.email ?? undefined },
      profile: (data as NavProfile | null) ?? null,
    }
  } catch (error) {
    console.error('[nav-auth] failed to resolve server navigation auth state', error)
    return { user: null, profile: null }
  }
})
