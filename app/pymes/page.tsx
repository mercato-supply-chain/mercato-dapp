import { aggregateDealsToStats, computePymeReputation } from '@/lib/pyme-reputation'
import { fetchPublicPymeProfiles, fetchPymeDealRows } from '@/lib/pymes/directory'
import { PymesList, type Smb } from './pymes-list'

const TIER_ORDER = { top_performer: 0, established: 1, building: 2, new: 3 } as const

const ACTIVE_DEAL_STATUSES = new Set(['funded', 'in_progress', 'milestone_pending'])

export default async function PymesPage() {
  const profiles = await fetchPublicPymeProfiles()
  const ids = profiles.map((p) => p.id)
  const dealRows = await fetchPymeDealRows(ids)

  const dealsBySmb: Record<string, { status: string; amount: number }[]> = {}
  for (const p of ids) dealsBySmb[p] = []
  for (const row of dealRows) {
    if (!dealsBySmb[row.pyme_id]) dealsBySmb[row.pyme_id] = []
    dealsBySmb[row.pyme_id].push({ status: row.status, amount: row.amount })
  }

  const smbs: Smb[] = profiles
    .map((p) => {
      const deals = dealsBySmb[p.id] ?? []
      const stats = aggregateDealsToStats(deals)
      const rep = computePymeReputation(stats)
      const active_deals = deals.filter((d) => ACTIVE_DEAL_STATUSES.has(d.status)).length
      return {
        id: p.id,
        company_name: p.company_name,
        full_name: p.full_name,
        contact_name: p.contact_name,
        bio: p.bio,
        country: p.country,
        sector: p.sector,
        verified: p.verified ?? false,
        deal_count: deals.length,
        active_deals,
        reputation: rep,
        reputationTier: rep.tier,
        totalRepaid: rep.stats.totalRepaid,
        completionRate: rep.completionRate,
      }
    })
    .toSorted((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      const tierDiff = TIER_ORDER[a.reputationTier] - TIER_ORDER[b.reputationTier]
      if (tierDiff !== 0) return tierDiff
      return b.deal_count - a.deal_count
    })

  return <PymesList initialSmbs={smbs} />
}
