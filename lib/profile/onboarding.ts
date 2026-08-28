export type OnboardingUserType = 'pyme' | 'investor' | 'supplier'

export const ONBOARDING_SETTINGS_PATH = '/settings?onboarding=1'

export function needsOnboarding(userType: string | null | undefined): boolean {
  return !userType
}

export function isOnboardingUserType(value: string): value is OnboardingUserType {
  return value === 'pyme' || value === 'investor' || value === 'supplier'
}

/**
 * Allowlist used by `public.handle_new_user()`. `admin` and unknown values
 * become null so signup metadata cannot create an administrator profile.
 */
export function resolveSignupUserType(meta: unknown): OnboardingUserType | null {
  if (typeof meta !== 'string') return null
  const trimmed = meta.trim()
  return isOnboardingUserType(trimmed) ? trimmed : null
}
