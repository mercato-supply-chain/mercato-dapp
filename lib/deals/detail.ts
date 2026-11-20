import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapDealFromDb, type DealRow } from '@/lib/deals'
import type { Deal } from '@/lib/types'

async function fetchDealDetail(id: string): Promise<Deal | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('deals')
    .select(
      `
      *,
      milestones(*),
      pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name, stake_amount, address),
      investor:profiles!deals_investor_id_fkey(company_name, full_name, contact_name),
      supplier:supplier_companies(company_name, full_name, contact_name, owner_id, address)
    `,
    )
    .eq('id', id)
    .maybeSingle<DealRow>()

  if (error || !data) return null
  const deal = mapDealFromDb(data)
  if (data.rwa_asset_row_id) {
    const { data: asset } = await supabase
      .from('rwa_assets')
      .select('asset_id, lifecycle, funded_principal_units, token_decimals')
      .eq('id', data.rwa_asset_row_id)
      .maybeSingle()
    if (asset) {
      const decimals = Number(asset.token_decimals ?? 7)
      deal.rwaAssetId = String(asset.asset_id)
      deal.rwaLifecycle = asset.lifecycle as Deal['rwaLifecycle']
      deal.confirmedPrincipal = Number(asset.funded_principal_units) / 10 ** decimals
    }
  }
  return deal
}

export const getDealDetail = cache(fetchDealDetail)
