import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

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
}

type DealSummaryRow = {
  id: string
  product_name: string | null
  title: string | null
  description: string | null
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
      'id, product_name, title, description, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name)',
    )
    .eq('id', id)
    .maybeSingle<DealSummaryRow>()

  if (error || !data) return null
  return {
    id: data.id,
    product_name: data.product_name ?? null,
    title: data.title ?? null,
    description: data.description ?? null,
    pyme: normalizePyme(data.pyme),
  }
}

export const getDealSummary = cache(fetchDealSummary)
