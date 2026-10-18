import type { NavProfile, NavUser } from '@/components/navigation/user-nav-types'

/**
 * Minimal profile projection required by the navigation and user menu.
 *
 * The navigation never needs the full profile row, so every query that feeds
 * `NavProfile` must use this explicit column list instead of `select('*')`.
 */
export const NAV_PROFILE_COLUMNS =
  'id, full_name, contact_name, company_name, user_type, avatar_url' as const

/** Server-serializable snapshot handed from the root layout to the provider. */
export interface NavAuthSnapshot {
  user: NavUser | null
  profile: NavProfile | null
}

/** Client-facing auth state shared by every navigation consumer. */
export interface NavAuthState extends NavAuthSnapshot {
  /** True once the auth state has been resolved (server, then client events). */
  ready: boolean
}
