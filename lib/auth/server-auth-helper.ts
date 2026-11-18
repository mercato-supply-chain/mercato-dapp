import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

/**
 * Shared server-side auth helper with caching.
 * Returns user and profile in a single call, avoiding duplicate auth checks.
 */
export async function getServerAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null, supabase }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile, supabase }
}

/**
 * Lightweight auth check for redirects (layout-level).
 * Only fetches user_type to avoid full profile load when not needed.
 */
export async function getServerAuthForRedirect() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, userType: null, supabase }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  return { user, userType: profile?.user_type ?? null, supabase }
}
