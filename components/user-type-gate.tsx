'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useNavAuth } from '@/components/providers/nav-auth-provider'
import { needsOnboarding, ONBOARDING_SETTINGS_PATH } from '@/lib/profile/onboarding'

/** Paths where we skip onboarding redirect checks. */
const SKIP_PREFIXES = ['/auth', '/api', '/settings']

export function UserTypeGate() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, ready } = useNavAuth()

  const shouldSkip = SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  useEffect(() => {
    if (shouldSkip || !ready || !user) return

    if (needsOnboarding(profile?.user_type)) {
      router.replace(ONBOARDING_SETTINGS_PATH)
    }
  }, [shouldSkip, ready, user, profile, pathname, router])

  return null
}
