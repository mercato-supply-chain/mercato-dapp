import type { SupabaseClient } from '@supabase/supabase-js'

export type ExpiredFundingDeal = {
  id: string
  title: string
  supplier_name: string | null
  amount: number | null
  funding_expires_at: string | null
  reopen_count: number | null
  last_reopened_at: string | null
}

export async function getExpiredFundingDeals(
  supabase: SupabaseClient,
  limit = 5,
): Promise<ExpiredFundingDeal[]> {
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('deals')
    .select('id, title, supplier_name, amount, funding_expires_at, reopen_count, last_reopened_at')
    .eq('status', 'seeking_funding')
    .is('investor_id', null)
    .lt('funding_expires_at', nowIso)
    .order('funding_expires_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getExpiredFundingDeals:', error.message)
    return []
  }

  return data ?? []
}
