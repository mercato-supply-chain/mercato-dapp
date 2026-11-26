export type DealViewerRole =
  | 'investor'
  | 'pyme'
  | 'supplier'
  | 'admin'
  | 'authenticated_viewer'
  | 'guest'

export interface DealViewerRoleInput {
  userId?: string | null
  userType: string | null
  isPyme: boolean
  isSupplier: boolean
  isAdmin: boolean
}

/**
 * Resolves the authoritative viewer role for a deal detail page so role-specific
 * action variants are composed explicitly rather than combined through overlapping
 * boolean flags.
 *
 * Non-party signed-in users (such as another PyME or Supplier browsing a deal
 * they are not a party to) resolve to `'authenticated_viewer'` rather than
 * `'guest'` so they see accurate investor-only notices instead of sign-in prompts.
 */
export function resolveDealViewerRole({
  userId = null,
  userType,
  isPyme,
  isSupplier,
  isAdmin,
}: DealViewerRoleInput): DealViewerRole {
  if (isAdmin || userType === 'admin') return 'admin'
  if (isPyme) return 'pyme'
  if (isSupplier) return 'supplier'
  if (userType === 'investor') return 'investor'
  if (Boolean(userId || userType)) return 'authenticated_viewer'
  return 'guest'
}
