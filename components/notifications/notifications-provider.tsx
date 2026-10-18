'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Resolve the current user, and keep it in sync with auth changes.
  useEffect(() => {
    let cancelled = false

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      const nextId = user?.id ?? null
      setUserId(nextId)
      if (!nextId) {
        setNotifications([])
        setIsLoading(false)
      }
    }

    void loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      const nextId = session?.user?.id ?? null
      setUserId(nextId)
      if (!nextId) {
        setNotifications([])
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  // Manual refresh (exposed to consumers). Always clears loading in `finally`.
  const refresh = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await notificationsRequest.fetch(userId)
      setNotifications(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Initial fetch whenever `userId` becomes available. Inlined so the effect
  // subscribes to a change in `userId` rather than calling into a stateful hook.
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await notificationsRequest.fetch(userId)
        if (!cancelled) setNotifications(data)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err : new Error('Failed to fetch notifications'),
          )
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
          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev
            return [incoming, ...prev].slice(0, NOTIFICATIONS_LIMIT)
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
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          )
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
      if (!userId) return
      const previous = notifications
      const now = new Date().toISOString()
      setNotifications((prev) =>
        prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)),
      )
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('id', id)
        .eq('user_id', userId)

      if (updateError) {
        setNotifications(previous)
        setError(updateError as unknown as Error)
      } else {
        notificationsRequest.invalidate(userId)
      }
    },
    [userId, notifications, supabase],
  )

  const markAllAsRead = useCallback(async () => {
    if (!userId) return
    const previous = notifications
    const now = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now })),
    )
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null)

    if (updateError) {
      setNotifications(previous)
      setError(updateError as unknown as Error)
    } else {
      notificationsRequest.invalidate(userId)
    }
  }, [userId, notifications, supabase])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  )

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      error,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [notifications, unreadCount, isLoading, error, refresh, markAsRead, markAllAsRead],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return ctx
}
