/** Notification types for deal lifecycle events */
export type NotificationType =
  | 'deal_created'
  | 'deal_funded'
  | 'milestone_1_approved'
  | 'milestone_2_approved'
  | 'pyme_investor_deal_created'
  | 'pyme_investor_deal_complete'
  | 'repayment_escrow_needed'
  | 'repayment_escrow_created'
  | 'goods_shipped'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link_url: string | null
  link_label: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link_url: string | null
  link_label: string | null
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export function mapNotificationFromDb(row: NotificationRow): Notification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body ?? null,
    link_url: row.link_url ?? null,
    link_label: row.link_label ?? null,
    metadata: row.metadata ?? {},
    read_at: row.read_at ?? null,
    created_at: row.created_at,
  }
}

/** Relative time string for display — pass `t` from useI18n for locale-aware strings. */
export function formatNotificationTime(
  iso: string,
  t: (key: string, replacements?: Record<string, string | number>) => string,
): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return t('notifications.justNow')
  if (diffMins < 60) return t('notifications.minsAgo', { n: diffMins })
  if (diffHours < 24) return t('notifications.hoursAgo', { n: diffHours })
  if (diffDays < 7) return t('notifications.daysAgo', { n: diffDays })
  return d.toLocaleDateString()
}
