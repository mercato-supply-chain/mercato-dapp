import type { SupabaseClient } from '@supabase/supabase-js'

type InvestorWalletProfile = {
  address?: string | null
  stellar_public_key?: string | null
}

/** Resolve the funded investor's Stellar wallet for escrow operations (server/client with RLS). */
export async function fetchInvestorWalletForDeal(
  supabase: SupabaseClient,
  dealId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('deals')
    .select('investor:profiles!deals_investor_id_fkey(address, stellar_public_key)')
    .eq('id', dealId)
    .maybeSingle()

  if (error || !data?.investor) return null

  const profile = data.investor as InvestorWalletProfile
  return (
    profile.address?.trim() ||
    profile.stellar_public_key?.trim() ||
    null
  )
}
