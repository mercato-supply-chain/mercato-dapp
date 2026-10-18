'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  invalidateNavProfile,
  loadNavProfile,
  primeNavProfile,
} from '@/lib/navigation/nav-auth-client'
import type { NavAuthSnapshot, NavAuthState } from '@/lib/navigation/nav-auth'
import type { NavProfile, NavUser } from '@/components/navigation/user-nav-types'

type NavAuthContextValue = NavAuthState & { clear: () => void }

const NavAuthContext = createContext<NavAuthContextValue | null>(null)

function toNavUser(user: User | null): NavUser | null {
  if (!user) return null
  return { id: user.id, email: user.email ?? undefined }
}

/**
 * Single client-side owner of the navigation auth/profile state.
 *
 * The initial snapshot is resolved on the server and handed in through
 * `initial`, so there is no post-hydration request. After hydration this
 * provider is the only subscriber to `supabase.auth.onAuthStateChange` and the
 * `mercato:profile-updated` event; every navigation consumer reads from the
 * shared context and the deduplicating cache in `nav-auth-client`.
 */
export function NavAuthProvider({
  initial,
  children,
}: {
  initial: NavAuthSnapshot
  children: ReactNode
}) {
  const supabase = useMemo(() => createClient(), [])
  const initialRef = useRef(initial)
  const [user, setUser] = useState<NavUser | null>(initial.user)
  const [profile, setProfile] = useState<NavProfile | null>(initial.profile)
  const [ready] = useState(true)
  const userIdRef = useRef<string | null>(initial.user?.id ?? null)

  const applySessionUser = useCallback(
    (authUser: User | null) => {
      const nextUser = toNavUser(authUser)
      const previousId = userIdRef.current
      userIdRef.current = nextUser?.id ?? null
      setUser(nextUser)

      if (!nextUser) {
        invalidateNavProfile()
        setProfile(null)
        return
      }

      // Same identity: keep the current profile, only the email can change.
      if (nextUser.id === previousId) return

      void loadNavProfile(supabase, nextUser.id).then((nextProfile) => setProfile(nextProfile))
    },
    [supabase],
  )

  useEffect(() => {
    // Seed the cache before subscribing so the auth client's replay of the
    // current session is served from the cache instead of a duplicate fetch.
    const snapshot = initialRef.current
    if (snapshot.user) primeNavProfile(snapshot.user.id, snapshot.profile)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // The server-resolved snapshot is authoritative for the first render.
      if (event === 'INITIAL_SESSION') return
      applySessionUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [applySessionUser, supabase])

  useEffect(() => {
    const onProfileUpdated = () => {
      const currentId = userIdRef.current
      if (!currentId) return
      invalidateNavProfile(currentId)
      void loadNavProfile(supabase, currentId).then((nextProfile) => setProfile(nextProfile))
    }

    window.addEventListener('mercato:profile-updated', onProfileUpdated)
    return () => window.removeEventListener('mercato:profile-updated', onProfileUpdated)
  }, [supabase])

  const clear = useCallback(() => {
    userIdRef.current = null
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo<NavAuthContextValue>(
    () => ({ user, profile, ready, clear }),
    [clear, profile, ready, user],
  )

  return <NavAuthContext.Provider value={value}>{children}</NavAuthContext.Provider>
}

export function useNavAuth(): NavAuthContextValue {
  const context = useContext(NavAuthContext)
  if (!context) {
    throw new Error('useNavAuth must be used within a NavAuthProvider')
  }
  return context
}
