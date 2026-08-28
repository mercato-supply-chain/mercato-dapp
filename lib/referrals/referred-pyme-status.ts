import { needsOnboarding } from '@/lib/profile/onboarding'

export type ReferredPymeStatus =
  | 'invited'
  | 'account_created'
  | 'onboarding_incomplete'
  | 'inactive'
  | 'active'

export type ReferredPymeProfileSnapshot = {
  id?: string | null
  user_type?: string | null
  company_name?: string | null
  country?: string | null
  sector?: string | null
}

export function hasPymeOnboardingFields(profile: ReferredPymeProfileSnapshot): boolean {
  return Boolean(
    profile.company_name?.trim() &&
      profile.country?.trim() &&
      profile.sector?.trim(),
  )
}

/** Deterministic referred-SME lifecycle status (single source of truth). */
export function getReferredPymeStatus(
  profile: ReferredPymeProfileSnapshot | null | undefined,
  dealCount: number,
): ReferredPymeStatus {
  if (!profile?.id) return 'invited'

  if (needsOnboarding(profile.user_type)) return 'account_created'

  if (profile.user_type !== 'pyme' || !hasPymeOnboardingFields(profile)) {
    return 'onboarding_incomplete'
  }

  if (dealCount <= 0) return 'inactive'
  return 'active'
}
