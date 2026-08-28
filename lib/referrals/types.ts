export type ReferralInvitationStatus = 'active' | 'revoked' | 'expired' | 'converted'

export type ReferralEventType =
  | 'invitation_created'
  | 'link_opened'
  | 'account_created'
  | 'onboarding_completed'
  | 'deal_created'
  | 'deal_funded'

export type ReferralInvitationRow = {
  id: string
  supplier_company_id: string
  created_by: string
  label: string | null
  recipient_email: string | null
  status: ReferralInvitationStatus
  token_hash: string
  expires_at: string | null
  converted_profile_id: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export type ReferralEventRow = {
  id: string
  invitation_id: string | null
  supplier_company_id: string
  profile_id: string | null
  event_type: ReferralEventType
  metadata: Record<string, unknown>
  created_at: string
}
