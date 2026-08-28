import type { ReferralEventType } from './types'

export type ReferralActivityItem = {
  id: string
  eventType: ReferralEventType | 'deal_created' | 'deal_funded'
  createdAt: string
  profileId: string | null
  invitationId: string | null
  metadata: Record<string, unknown>
  /** When consecutive link_opened events are grouped. */
  groupedOpenCount?: number
}

export function groupReferralActivityItems(items: ReferralActivityItem[]): ReferralActivityItem[] {
  const result: ReferralActivityItem[] = []

  for (const item of items) {
    if (item.eventType !== 'link_opened') {
      result.push(item)
      continue
    }

    const prev = result[result.length - 1]
    if (prev?.eventType === 'link_opened' && prev.invitationId === item.invitationId) {
      prev.groupedOpenCount = (prev.groupedOpenCount ?? 1) + 1
      continue
    }

    result.push({ ...item, groupedOpenCount: 1 })
  }

  return result
}
