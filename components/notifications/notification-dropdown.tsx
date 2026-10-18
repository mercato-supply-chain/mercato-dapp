'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, Package, CheckCircle2, Loader2 } from 'lucide-react'
import { formatNotificationTime } from '@/lib/notifications'
import { useMounted } from '@/hooks/use-mounted'
import { useI18n } from '@/lib/i18n/provider'
import { useNotifications } from '@/components/notifications/notifications-provider'

export function NotificationDropdown() {
  const { t } = useI18n()
  const mounted = useMounted()
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useNotifications()
  const [isOpen, setIsOpen] = useState(false)

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

  if (!mounted) return trigger

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
                      if (!n.read_at) void markAsRead(n.id)
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
