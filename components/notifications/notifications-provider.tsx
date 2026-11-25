'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  notificationsRequest,
  NOTIFICATIONS_LIMIT,
} from '@/lib/client/notifications-cache'
import {
  mapNotificationFromDb,
  type Notification,
} from '@/lib/notifications'
import { useOptionalNavAuth } from '@/components/providers/nav-auth-provider'
import {
  NotificationsContext,
  useNotifications,
  useNotificationsContext,
  type NotificationsContextValue,
} from '@/components/notifications/notifications-context'

export { useNotifications, useNotificationsContext, type NotificationsContextValue }

type NotificationsBucket = {
  ownerId: string | null
  items: Notification[]
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const navAuth = useOptionalNavAuth()
  const hasNavAuthProvider = navAuth !== null
  const isNavAuthReady = hasNavAuthProvider ? navAuth.ready : true
  const primedUserId =
    hasNavAuthProvider && navAuth.ready ? (navAuth.user?.id ?? null) : null

  const [fallbackUserId, setFallbackUserId] = useState<string | null>(null)
  const [bucket, setBucket] = useState<NotificationsBucket>({
    ownerId: null,
    items: [],
  })
  const [isLoading, setIsLoading] = useState<boolean>(
    hasNavAuthProvider ? !navAuth.ready || Boolean(primedUserId) : true,
  )
  const [errorState, setErrorState] = useState<{
    ownerId: string | null
    error: Error | null
  }>({ ownerId: null, error: null })
  const supabase = useMemo(() => createClient(), [])

  const userId = hasNavAuthProvider ? primedUserId : fallbackUserId
  const activeUserIdRef = useRef<string | null>(userId)
  useEffect(() => {
    activeUserIdRef.current = userId
  }, [userId])

  // Resolve the current user, and keep it in sync with auth changes only when
  // NotificationsProvider is mounted without NavAuthProvider (e.g. isolated unit tests).
  // When NavAuthProvider is present, never fall back to getUser()/onAuthStateChange during
  // `ready === false` transitions.
  useEffect(() => {
    if (hasNavAuthProvider) return
    let cancelled = false

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      const nextId = user?.id ?? null
      setFallbackUserId(nextId)
      if (!nextId) {
        setBucket({ ownerId: null, items: [] })
        setIsLoading(false)
      }
    }

    void loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      const nextId = session?.user?.id ?? null
      setFallbackUserId(nextId)
      if (!nextId) {
        setBucket({ ownerId: null, items: [] })
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [hasNavAuthProvider, supabase])

  const visibleNotifications = useMemo(
    () => (userId && bucket.ownerId === userId ? bucket.items : []),
    [bucket, userId],
  )
  const visibleError =
    userId && errorState.ownerId === userId ? errorState.error : null

  // Manual refresh (exposed to consumers). Guarded by activeUserIdRef so a stale
  // response from a previous account never overwrites the newly active account's bucket.
  const refresh = useCallback(async () => {
    const requestUserId = userId
    if (!requestUserId) return
    setIsLoading(true)
    setErrorState({ ownerId: requestUserId, error: null })
    try {
      const data = await notificationsRequest.fetch(requestUserId)
      if (activeUserIdRef.current !== requestUserId) return
      setBucket({ ownerId: requestUserId, items: data })
    } catch (err) {
      if (activeUserIdRef.current !== requestUserId) return
      setErrorState({
        ownerId: requestUserId,
        error: err instanceof Error ? err : new Error('Failed to fetch notifications'),
      })
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setIsLoading(false)
      }
    }
  }, [userId])

  // Initial fetch whenever `userId` becomes available. Inlined so the effect
  // subscribes to a change in `userId` rather than calling into a stateful hook.
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      setErrorState({ ownerId: userId, error: null })
      try {
        const data = await notificationsRequest.fetch(userId)
        if (!cancelled) setBucket({ ownerId: userId, items: data })
      } catch (err) {
        if (!cancelled) {
          setErrorState({
            ownerId: userId,
            error:
              err instanceof Error ? err : new Error('Failed to fetch notifications'),
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId])

  // Realtime: apply payloads to state instead of refetching.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications-changes:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          notificationsRequest.invalidate(userId)
          const incoming = mapNotificationFromDb(payload.new as never)
          setBucket((prev) => {
            const currentItems = prev.ownerId === userId ? prev.items : []
            if (currentItems.some((n) => n.id === incoming.id)) return prev
            return {
              ownerId: userId,
              items: [incoming, ...currentItems].slice(0, NOTIFICATIONS_LIMIT),
            }
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          notificationsRequest.invalidate(userId)
          const updated = mapNotificationFromDb(payload.new as never)
          setBucket((prev) => {
            if (prev.ownerId !== userId) return prev
            return {
              ownerId: userId,
              items: prev.items.map((n) => (n.id === updated.id ? updated : n)),
            }
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  // Mutations: optimistic update, roll back on error, no refetch.
  const markAsRead = useCallback(
    async (id: string) => {
      const requestUserId = userId
      if (!requestUserId) return
      const previous = visibleNotifications
      const now = new Date().toISOString()
      setBucket((prev) => {
        if (prev.ownerId !== requestUserId) return prev
        return {
          ownerId: requestUserId,
          items: prev.items.map((n) =>
            n.id === id && !n.read_at ? { ...n, read_at: now } : n,
          ),
        }
      })
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('id', id)
        .eq('user_id', requestUserId)

      if (updateError) {
        if (activeUserIdRef.current === requestUserId) {
          setBucket({ ownerId: requestUserId, items: previous })
          setErrorState({
            ownerId: requestUserId,
            error: updateError as unknown as Error,
          })
        }
      } else {
        notificationsRequest.invalidate(requestUserId)
      }
    },
    [userId, visibleNotifications, supabase],
  )

  const markAllAsRead = useCallback(async () => {
    const requestUserId = userId
    if (!requestUserId) return
    const previous = visibleNotifications
    const now = new Date().toISOString()
    setBucket((prev) => {
      if (prev.ownerId !== requestUserId) return prev
      return {
        ownerId: requestUserId,
        items: prev.items.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      }
    })
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', requestUserId)
      .is('read_at', null)

    if (updateError) {
      if (activeUserIdRef.current === requestUserId) {
        setBucket({ ownerId: requestUserId, items: previous })
        setErrorState({
          ownerId: requestUserId,
          error: updateError as unknown as Error,
        })
      }
    } else {
      notificationsRequest.invalidate(requestUserId)
    }
  }, [userId, visibleNotifications, supabase])

  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !n.read_at).length,
    [visibleNotifications],
  )

  const visibleLoading = userId
    ? bucket.ownerId !== userId || isLoading
    : hasNavAuthProvider
      ? !isNavAuthReady
      : isLoading

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications: visibleNotifications,
      unreadCount,
      isLoading: visibleLoading,
      error: visibleError,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [
      visibleNotifications,
      unreadCount,
      visibleLoading,
      visibleError,
      refresh,
      markAsRead,
      markAllAsRead,
    ],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}
