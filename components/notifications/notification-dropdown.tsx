'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, Package, CheckCircle2, Loader2 } from 'lucide-react'
import {
  mapNotificationFromDb,
  formatNotificationTime,
  type Notification,
} from '@/lib/notifications'
import { useMounted } from '@/hooks/use-mounted'
import { useI18n } from '@/lib/i18n/provider'

interface NotificationDropdownProps {
  userId: string
  /** Desktop: show inline. Mobile: may need different placement */
  variant?: 'desktop' | 'mobile'
}

// Explicit column list — never `*` — matching `NotificationRow`.
const NOTIFICATION_COLUMNS =
  'id,user_id,type,title,body,link_url,link_label,metadata,read_at,created_at'

const NOTIFICATION_LIMIT = 20

// Shared in-flight request cache keyed by user. Desktop + mobile dropdowns
// (and any other consumer) share one request instead of firing duplicates.
const inflightByUser = new Map<string, Promise<Notification[]>>()

export function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const { t } = useI18n()
  const mounted = useMounted()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const loadNotifications = useCallback(async (): Promise<Notification[]> => {
    const existing = inflightByUser.get(userId)
    if (existing) return existing

    const request = (async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(NOTIFICATION_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_LIMIT)
      if (error) {
        console.error('Failed to fetch notifications:', error)
        return []
      }
      return (data ?? []).map(mapNotificationFromDb)
    })()

    inflightByUser.set(userId, request)
    try {
      return await request
    } finally {
      if (inflightByUser.get(userId) === request) {
        inflightByUser.delete(userId)
      }
    }
  }, [userId, supabase])

  const fetchNotifications = useCallback(async () => {
    const mapped = await loadNotifications()
    setNotifications(mapped)
    setUnreadCount(mapped.filter((n) => !n.read_at).length)
  }, [loadNotifications])

  const upsertRealtimeRow = useCallback(
    (row: unknown, event: 'INSERT' | 'UPDATE', oldRow?: unknown) => {
      let mapped: Notification
      try {
        mapped = mapNotificationFromDb(
          row as Parameters<typeof mapNotificationFromDb>[0],
        )
      } catch {
        // Unusable payload shape — fall back to a shared refetch.
        void fetchNotifications()
        return
      }
      setNotifications((prev) => {
        const next = prev.some((n) => n.id === mapped.id)
          ? prev.map((n) => (n.id === mapped.id ? mapped : n))
          : [mapped, ...prev]
        return next
          .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
          .slice(0, NOTIFICATION_LIMIT)
      })
      // Badge delta derived from the payload alone (no state read, so the
      // updater stays pure under StrictMode).
      if (event === 'INSERT') {
        if (!mapped.read_at) setUnreadCount((c) => c + 1)
      } else {
        try {
          const old = oldRow as { read_at?: string | null } | undefined
          if (old && 'read_at' in (old as object)) {
            const wasUnread = !old.read_at
            const nowUnread = !mapped.read_at
            if (wasUnread && !nowUnread) setUnreadCount((c) => Math.max(0, c - 1))
            else if (!wasUnread && nowUnread) setUnreadCount((c) => c + 1)
          } else {
            // Replica identity didn't include the old row — resync once.
            void fetchNotifications()
          }
        } catch {
          void fetchNotifications()
        }
      }
    },
    [fetchNotifications],
  )

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // Intentional re-render on user change: show the spinner while the new
    // user's list loads. The `cancelled` guard below prevents a stale write.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)
    fetchNotifications()
      .catch((error) => {
        console.error('Failed to fetch notifications:', error)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, fetchNotifications])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => upsertRealtimeRow(payload.new, 'INSERT'),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => upsertRealtimeRow(payload.new, 'UPDATE', payload.old),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, upsertRealtimeRow])

  const markAsRead = async (id: string) => {
    // Optimistic update — no full refetch on success. Only called for
    // unread items (see the list item onClick guard below).
    const stampedAt = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: stampedAt } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: stampedAt })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) {
      console.error('Failed to mark notification as read:', error)
      void fetchNotifications()
    }
  }

  const markAllAsRead = async () => {
    const stampedAt = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? stampedAt })))
    setUnreadCount(0)
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: stampedAt })
      .eq('user_id', userId)
      .is('read_at', null)
    if (error) {
      console.error('Failed to mark all notifications as read:', error)
      // Resync from the shared request on failure.
      void fetchNotifications()
    }
  }

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('notifications.ariaLabel')}
      className="relative"
      type="button"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unreadCount > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground"
          aria-label={t('notifications.unreadCount', { count: unreadCount })}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  )

  if (!mounted) {
    return trigger
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{t('notifications.title')}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 text-xs"
              onClick={markAllAsRead}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[min(320px,50vh)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Bell className="h-10 w-10" />
              <p>{t('notifications.empty')}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link_url || '#'}
                    onClick={() => {
                      if (!n.read_at) markAsRead(n.id)
                      setIsOpen(false)
                    }}
                    className={`block px-3 py-3 transition-colors hover:bg-muted/50 ${
                      !n.read_at ? 'bg-muted/30' : ''
                    }`}
                  >
                    <div className="flex gap-2">
                      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
                        {n.type.includes('milestone') ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatNotificationTime(n.created_at, t)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
