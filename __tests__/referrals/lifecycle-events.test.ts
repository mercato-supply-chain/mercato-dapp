import { describe, expect, test } from 'bun:test'
import type { ReferralEventType } from '@/lib/referrals/types'
import { groupReferralActivityItems } from '@/lib/referrals/activity-grouping'

const FUNNEL_EVENTS: ReferralEventType[] = [
  'invitation_created',
  'link_opened',
  'signup_started',
  'account_created',
  'onboarding_completed',
  'invitation_revoked',
]

describe('referral invitation lifecycle events', () => {
  test('includes signup_started and invitation_revoked in the funnel set', () => {
    expect(FUNNEL_EVENTS).toContain('signup_started')
    expect(FUNNEL_EVENTS).toContain('invitation_revoked')
  })

  test('activity grouping still collapses consecutive link_opened events', () => {
    const grouped = groupReferralActivityItems([
      {
        id: '1',
        eventType: 'link_opened',
        createdAt: '2026-01-01T00:00:00Z',
        profileId: null,
        invitationId: 'inv-1',
        metadata: {},
      },
      {
        id: '2',
        eventType: 'link_opened',
        createdAt: '2026-01-01T00:01:00Z',
        profileId: null,
        invitationId: 'inv-1',
        metadata: {},
      },
      {
        id: '3',
        eventType: 'signup_started',
        createdAt: '2026-01-01T00:02:00Z',
        profileId: null,
        invitationId: 'inv-1',
        metadata: {},
      },
    ])

    expect(grouped).toHaveLength(2)
    expect(grouped[0]?.eventType).toBe('link_opened')
    expect(grouped[0]?.groupedOpenCount).toBe(2)
    expect(grouped[1]?.eventType).toBe('signup_started')
  })
})
