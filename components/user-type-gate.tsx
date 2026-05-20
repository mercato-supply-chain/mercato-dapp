'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { needsOnboarding, ONBOARDING_SETTINGS_PATH } from '@/lib/profile/onboarding'

/** Paths where we skip onboarding redirect checks. */
const SKIP_PREFIXES = ['/auth', '/api', '/settings']

export function UserTypeGate() {
  const pathname = usePathname()
  const router = useRouter()

  const shouldSkip = SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  useEffect(() => {
    if (shouldSkip) return

    const supabase = createClient()

    const checkProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()

      if (needsOnboarding(profile?.user_type)) {
        router.replace(ONBOARDING_SETTINGS_PATH)
      }
    }

    void checkProfile()
  }, [shouldSkip, pathname, router])

  return null
}
