import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { mapDealFromDb, type DealRow } from '@/lib/deals'
import type { Deal } from '@/lib/types'

export type DealSummaryPyme = {
  company_name: string | null
  full_name: string | null
  contact_name: string | null
}

export type DealSummary = {
  id: string
  product_name: string | null
  title: string | null
  description: string | null
  pyme: DealSummaryPyme | null
  deal: Deal
}

type DealSummaryRow = Omit<DealRow, 'pyme'> & {
  pyme: DealSummaryPyme | DealSummaryPyme[] | null
}

function normalizePyme(pyme: DealSummaryRow['pyme']): DealSummaryPyme | null {
  if (!pyme) return null
  const row = Array.isArray(pyme) ? pyme[0] : pyme
  if (!row) return null
  return {
    company_name: row.company_name ?? null,
    full_name: row.full_name ?? null,
    contact_name: row.contact_name ?? null,
  }
}

async function fetchDealSummary(id: string): Promise<DealSummary | null> {
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
    .maybeSingle<DealSummaryRow>()

  if (error || !data) return null
  const pyme = Array.isArray(data.pyme) ? data.pyme[0] ?? null : data.pyme
  const deal = mapDealFromDb({ ...data, pyme } as DealRow)
  if (data.rwa_asset_row_id) {
    const { data: asset } = await supabase
      .from('rwa_assets')
      .select('asset_id, lifecycle, funded_principal_units, token_decimals')
      .eq('id', data.rwa_asset_row_id)
      .maybeSingle()
    if (asset) {
      deal.rwaAssetId = String(asset.asset_id)
      deal.rwaLifecycle = asset.lifecycle as Deal['rwaLifecycle']
      deal.confirmedPrincipal =
        Number(asset.funded_principal_units) / 10 ** Number(asset.token_decimals ?? 7)
    }
  }
  return {
    id: data.id,
    product_name: data.product_name ?? null,
    title: data.title ?? null,
    description: data.description ?? null,
    pyme: normalizePyme(data.pyme),
    deal,
  }
}

export const getDealSummary = cache(fetchDealSummary)
