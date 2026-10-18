import { createDedupedFetcher } from '@/lib/client/deduped-fetch'
import { createClient } from '@/lib/supabase/client'
import { mapNotificationFromDb, type Notification } from '@/lib/notifications'

/** Explicit columns — avoids transferring metadata blobs and future-added columns. */
const NOTIFICATION_COLUMNS =
  'id, user_id, type, title, body, link_url, link_label, read_at, created_at'

export const NOTIFICATIONS_LIMIT = 20

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_LIMIT)

  if (error) throw error
  return (data ?? []).map(mapNotificationFromDb)
}

export const notificationsRequest = createDedupedFetcher(
  fetchNotifications,
  (userId) => `notifications:${userId}`,
  5_000, // short TTL — realtime keeps us fresh
)
