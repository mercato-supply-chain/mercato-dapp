import { cache } from 'react'
import { getLeads } from '@/lib/admin/get-leads'
import { createServiceClient } from '@/lib/supabase/service'

export type TractionUser = {
  id: string
  email: string
  user_type: string
  display_name: string
  company_name: string | null
  country: string | null
}

export type TractionLead = {
  id: string
  name: string
  company: string | null
  role: string | null
  address: string | null
  event_slug: string
}

export type TractionSummary = {
  totalUsers: number
  totalLeads: number
}

export type TractionData = {
  users: TractionUser[]
  leads: TractionLead[]
  eventSlugs: string[]
  summary: TractionSummary
}

function displayName(profile: {
  company_name: string | null
  full_name: string | null
  contact_name: string | null
}): string {
  return (
    profile.company_name?.trim() ||
    profile.full_name?.trim() ||
    profile.contact_name?.trim() ||
    ''
  )
}

async function fetchTractionData(): Promise<TractionData> {
  const supabase = createServiceClient()

  const [{ data: profiles }, leadRows] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, user_type, company_name, full_name, contact_name, country')
      .neq('user_type', 'admin')
      .order('created_at', { ascending: false }),
    getLeads(supabase),
  ])

  const users: TractionUser[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    user_type: p.user_type ?? 'unknown',
    display_name: displayName(p),
    company_name: p.company_name,
    country: p.country,
  }))

  const leads: TractionLead[] = leadRows.map((lead) => ({
    id: lead.id,
    name: lead.name,
    company: lead.company,
    role: lead.role,
    address: lead.country,
    event_slug: lead.event_slug,
  }))

  const eventSlugs = [...new Set(leads.map((lead) => lead.event_slug))].sort()

  return {
    users,
    leads,
    eventSlugs,
    summary: {
      totalUsers: users.length,
      totalLeads: leads.length,
    },
  }
}

export const getTractionData = cache(fetchTractionData)
