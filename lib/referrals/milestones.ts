import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationType } from '@/lib/notifications'
import { logReferralEvent } from './log-event'

export type ReferralMilestoneKind = 'onboarding_completed' | 'deal_created' | 'deal_funded'

const MILESTONE_NOTIFICATION: Record<
  ReferralMilestoneKind,
  { type: NotificationType; title: string; linkLabel: string }
> = {
  onboarding_completed: {
    type: 'pyme_referral_onboarded',
    title: 'A referred PyME completed onboarding',
    linkLabel: 'View referrals',
  },
  deal_created: {
    type: 'pyme_referral_first_deal',
    title: 'A referred PyME created their first deal',
    linkLabel: 'View referrals',
  },
  deal_funded: {
    type: 'pyme_referral_first_funded',
    title: 'A referred PyME received their first funded deal',
    linkLabel: 'View referrals',
  },
}

const MILESTONE_EVENT: Record<ReferralMilestoneKind, 'onboarding_completed' | 'deal_created' | 'deal_funded'> = {
  onboarding_completed: 'onboarding_completed',
  deal_created: 'deal_created',
  deal_funded: 'deal_funded',
}

async function hasExistingNotification(
  service: SupabaseClient,
  ownerId: string,
  type: NotificationType,
  pymeId: string,
): Promise<boolean> {
  const { count } = await service
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ownerId)
    .eq('type', type)
    .contains('metadata', { pyme_id: pymeId })

  return (count ?? 0) > 0
}

export async function processReferralMilestone(
  service: SupabaseClient,
  pymeId: string,
  milestone: ReferralMilestoneKind,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { data: profile } = await service
    .from('profiles')
    .select('referred_by_supplier_id, referral_invitation_id, user_type')
    .eq('id', pymeId)
    .maybeSingle()

  if (!profile?.referred_by_supplier_id) return
  if (milestone === 'onboarding_completed' && profile.user_type !== 'pyme') return

  const { data: company } = await service
    .from('supplier_companies')
    .select('owner_id')
    .eq('id', profile.referred_by_supplier_id)
    .maybeSingle()

  if (!company?.owner_id) return

  if (milestone === 'deal_created' || milestone === 'deal_funded') {
    const statusFilter =
      milestone === 'deal_funded'
        ? ['funded', 'in_progress', 'completed']
        : undefined

    let query = service.from('deals').select('id', { count: 'exact', head: true }).eq('pyme_id', pymeId)
    if (statusFilter) {
      query = query.in('status', statusFilter)
    }
    const { count } = await query
    if ((count ?? 0) !== 1) return
  }

  await logReferralEvent(service, {
    supplierCompanyId: profile.referred_by_supplier_id,
    invitationId: profile.referral_invitation_id,
    profileId: pymeId,
    eventType: MILESTONE_EVENT[milestone],
    metadata: metadata ?? {},
  })

  const notification = MILESTONE_NOTIFICATION[milestone]
  const alreadySent = await hasExistingNotification(
    service,
    company.owner_id,
    notification.type,
    pymeId,
  )
  if (alreadySent) return

  await service.from('notifications').insert({
    user_id: company.owner_id,
    type: notification.type,
    title: notification.title,
    body: null,
    link_url: `/dashboard/referrals?pyme=${pymeId}`,
    link_label: notification.linkLabel,
    metadata: { pyme_id: pymeId, supplier_company_id: profile.referred_by_supplier_id },
  })
}
