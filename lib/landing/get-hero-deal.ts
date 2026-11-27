import { cache } from 'react'
import { mapDealFromDb, type DealRow } from '@/lib/deals'
import { pickHeroDeal, sampleHeroDeal, type LandingHeroDeal } from '@/lib/landing/hero-deal'
import { createPublicClient } from '@/lib/supabase/public'

export type { LandingHeroDeal } from '@/lib/landing/hero-deal'

/** Candidates to scan; expired windows are filtered after mapping. */
const CANDIDATE_LIMIT = 6

async function fetchLandingHeroDeal(): Promise<LandingHeroDeal> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('deals')
      .select('*, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name)')
      .eq('status', 'seeking_funding')
      .order('created_at', { ascending: false })
      .limit(CANDIDATE_LIMIT)

    if (error) {
      console.error('[getLandingHeroDeal]', error.message)
      return sampleHeroDeal()
    }
    return pickHeroDeal(((data ?? []) as DealRow[]).map(mapDealFromDb))
  } catch (e) {
    console.error('[getLandingHeroDeal]', e)
    return sampleHeroDeal()
  }
}

export const getLandingHeroDeal = cache(fetchLandingHeroDeal)
