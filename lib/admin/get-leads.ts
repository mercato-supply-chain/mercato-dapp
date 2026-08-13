import type { SupabaseClient } from '@supabase/supabase-js'

export type LeadRow = {
  id: string
  event_slug: string
  name: string
  email: string
  company: string | null
  role: string | null
  country: string | null
  phone: string | null
  current_financing: string | null
  funding_timeline: string | null
  supplier_payment_process: string | null
  biggest_challenge: string | null
  last_financing_experience: string | null
  locale: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export async function getLeads(
  supabase: SupabaseClient,
  eventSlug?: string | null,
): Promise<LeadRow[]> {
  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (eventSlug) {
    query = query.eq('event_slug', eventSlug)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch leads:', error)
    return []
  }

  return (data ?? []) as LeadRow[]
}

export async function getLeadEventSlugs(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('event_slug')
    .order('event_slug')

  if (error || !data) return []

  return [...new Set(data.map((row) => row.event_slug as string))].sort()
}
