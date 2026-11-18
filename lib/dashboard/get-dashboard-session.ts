import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// One projection shared by the dashboard layout and the investments page: `cache()` only
// deduplicates identical calls, so callers must ask for the same columns to share one query.
// It is also everything getDashboardData reads, so the dashboard home can reuse it.
const DASHBOARD_PROFILE_COLUMNS = 'user_type, full_name, company_name, contact_name'

export type DashboardProfile = {
  user_type: string | null
  full_name: string | null
  company_name: string | null
  contact_name: string | null
}

/**
 * The request's Supabase client, signed-in user and profile, loaded once per request.
 *
 * `cache()` makes the dashboard layout and the page it wraps share a single auth check and a
 * single profile query. It never redirects: each caller keeps its own redirect decisions.
 *
 * The result is memoized for the whole render, so use it for reads. Code that changes auth or
 * profile state should create its own client and re-read afterwards.
 */
export const getDashboardSession = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(DASHBOARD_PROFILE_COLUMNS)
    .eq('id', user.id)
    .single<DashboardProfile>()

  return { supabase, user, profile }
})
