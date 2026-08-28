import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReferralEventType } from './types'

export async function logReferralEvent(
  supabase: SupabaseClient,
  params: {
    supplierCompanyId: string
    eventType: ReferralEventType
    invitationId?: string | null
    profileId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('referral_events').insert({
    supplier_company_id: params.supplierCompanyId,
    invitation_id: params.invitationId ?? null,
    profile_id: params.profileId ?? null,
    event_type: params.eventType,
    metadata: params.metadata ?? {},
  })
  if (error) {
    console.error('[referral] log event failed', error)
  }
}
