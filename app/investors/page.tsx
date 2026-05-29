import { createClient } from '@/lib/supabase/server'
import { InvestorsList, type Investor } from './investors-list'
import { JsonLd } from '@/components/seo/json-ld'

export async function generateMetadata() {
  return {
    title: 'Investor Directory | Mercato Supply Chain Finance',
    description: 'Explore the directory of active investors funding supply chain deals in Latin America on Mercato.',
    alternates: {
      canonical: '/investors',
      languages: {
        en: '/investors?lang=en',
        es: '/investors?lang=es',
      },
    },
  }
}

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://mercato.app"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Investors",
      "item": "https://mercato.app/investors"
    }
  ]
}

export default async function InvestorsPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, company_name, full_name, contact_name, bio, email, country, sector, verified')
    .eq('user_type', 'investor')
    .order('company_name')

  const ids = (profiles ?? []).map((p) => p.id)

  const { data: dealRows } =
    ids.length > 0
      ? await supabase
          .from('deals')
          .select('investor_id, amount, status')
          .in('investor_id', ids)
      : { data: [] as { investor_id: string; amount: number; status: string }[] }

  const stats: Record<string, { count: number; active: number; completed: number; total: number }> = {}
  for (const row of dealRows ?? []) {
    if (!row.investor_id) continue
    if (!stats[row.investor_id]) stats[row.investor_id] = { count: 0, active: 0, completed: 0, total: 0 }
    stats[row.investor_id].count += 1
    stats[row.investor_id].total += Number(row.amount ?? 0)
    if (row.status === 'funded' || row.status === 'in_progress') stats[row.investor_id].active += 1
    if (row.status === 'completed') stats[row.investor_id].completed += 1
  }

  const investors: Investor[] = (profiles ?? [])
    .map((p) => {
      const s = stats[p.id] ?? { count: 0, active: 0, completed: 0, total: 0 }
      return {
        id: p.id,
        company_name: p.company_name,
        full_name: p.full_name,
        contact_name: p.contact_name,
        bio: p.bio,
        email: p.email,
        country: p.country,
        sector: p.sector,
        verified: p.verified ?? false,
        deal_count: s.count,
        active_deals: s.active,
        completed_deals: s.completed,
        total_invested: s.total,
      }
    })
    .toSorted((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      return b.total_invested - a.total_invested
    })

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <InvestorsList initialInvestors={investors} />
    </>
  )
}
