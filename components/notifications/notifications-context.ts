'use client'

import { createContext, useContext } from 'react'
import type { Notification } from '@/lib/notifications'

export interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return ctx
}

/** Same context, but `null` when the tree has not mounted a provider yet. */
export function useNotificationsContext(): NotificationsContextValue | null {
  return useContext(NotificationsContext)
}
