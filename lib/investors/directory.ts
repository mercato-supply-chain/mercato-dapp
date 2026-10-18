import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type PublicInvestorProfile = {
  id: string
  company_name: string | null
  bio: string | null
  full_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  user_type: string | null
  country: string | null
  sector: string | null
  verified: boolean | null
  stake_amount: number | null
}

const DETAIL_COLUMNS =
  'id, company_name, bio, full_name, contact_name, email, phone, user_type, country, sector, verified, stake_amount'

/** Single public investor profile, or null when missing or not an investor. */
export async function fetchPublicInvestorProfile(
  id: string,
): Promise<PublicInvestorProfile | null> {
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error || !profile) return null
  if (profile.user_type !== 'investor') return null
  return profile as PublicInvestorProfile
}

export const getPublicInvestorProfile = cache(fetchPublicInvestorProfile)
