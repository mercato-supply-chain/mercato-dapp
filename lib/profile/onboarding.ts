export type OnboardingUserType = 'pyme' | 'investor' | 'supplier'

export const ONBOARDING_SETTINGS_PATH = '/settings?onboarding=1'

export function needsOnboarding(userType: string | null | undefined): boolean {
  return !userType
}

export function isOnboardingUserType(value: string): value is OnboardingUserType {
  return value === 'pyme' || value === 'investor' || value === 'supplier'
}
