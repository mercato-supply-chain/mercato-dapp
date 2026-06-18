import { heroIllustrativeDeals } from '@/lib/hero-illustrative-deals'
import { formatCurrency } from '@/lib/format'
import type { Deal } from '@/lib/types'

export type FeedEventType = 'open' | 'funded' | 'production' | 'milestone' | 'repaid'

export type LandingFeedItem = {
  id: string
  href: string
  eventType: FeedEventType
  /** @deprecated Prefer eventLabelKey — kept for type compatibility */
  eventLabel: string
  eventLabelKey: string
  eventLabelParams?: Record<string, string | number>
  productName: string
  companyLine: string
  amountLabel: string
  aprLabel?: string
  termDays: number
  category?: string
  milestonesCompleted: number
  milestonesTotal: number
  isLive: boolean
}

const EVENT_BY_STATUS: Record<string, { type: FeedEventType; labelKey: string }> = {
  awaiting_funding: { type: 'open', labelKey: 'landing.liveDeals.events.open' },
  funded: { type: 'funded', labelKey: 'landing.liveDeals.events.funded' },
  in_progress: { type: 'production', labelKey: 'landing.liveDeals.events.production' },
  milestone_pending: { type: 'milestone', labelKey: 'landing.liveDeals.events.milestonePending' },
  completed: { type: 'repaid', labelKey: 'landing.liveDeals.events.repaid' },
  released: { type: 'repaid', labelKey: 'landing.liveDeals.events.released' },
  disputed: { type: 'milestone', labelKey: 'landing.liveDeals.events.underReview' },
}

function milestoneEvent(
  deal: Deal,
): { labelKey: string; params?: Record<string, string | number> } {
  const completed = deal.milestones.filter((m) => m.status === 'completed').length
  const total = deal.milestones.length
  const fallback = EVENT_BY_STATUS[deal.status] ?? EVENT_BY_STATUS.awaiting_funding
  if (total === 0) {
    return { labelKey: fallback.labelKey }
  }
  if (completed >= total) {
    return { labelKey: 'landing.liveDeals.events.allMilestonesComplete' }
  }
  const inProgress = deal.milestones.find((m) => m.status === 'in_progress')
  if (inProgress) {
    return {
      labelKey: 'landing.liveDeals.events.milestoneInProgress',
      params: { name: inProgress.name },
    }
  }
  if (completed > 0) {
    return {
      labelKey: 'landing.liveDeals.events.milestoneReleased',
      params: { completed, total },
    }
  }
  return { labelKey: fallback.labelKey }
}

export function dealToFeedItem(deal: Deal): LandingFeedItem {
  const base = EVENT_BY_STATUS[deal.status] ?? EVENT_BY_STATUS.awaiting_funding
  const completed = deal.milestones.filter((m) => m.status === 'completed').length
  const eventType =
    deal.status === 'in_progress' || deal.status === 'milestone_pending'
      ? completed > 0
        ? 'milestone'
        : 'production'
      : base.type

  const milestone =
    eventType === 'milestone' || eventType === 'production'
      ? milestoneEvent(deal)
      : { labelKey: base.labelKey }

  return {
    id: deal.id,
    href: `/deals/${deal.id}`,
    eventType,
    eventLabel: '',
    eventLabelKey: milestone.labelKey,
    eventLabelParams: milestone.params,
    productName: deal.productName,
    companyLine: [deal.pymeName, deal.supplier].filter(Boolean).join(' · '),
    amountLabel: formatCurrency(deal.priceUSDC),
    aprLabel: deal.yieldAPR != null ? `${deal.yieldAPR.toFixed(1)}%` : undefined,
    termDays: deal.term,
    category: deal.category,
    milestonesCompleted: completed,
    milestonesTotal: deal.milestones.length,
    isLive: true,
  }
}

function illustrativeToFeed(): LandingFeedItem[] {
  return heroIllustrativeDeals.map((d) => ({
    id: `illus-${d.key}`,
    href: d.cta.href,
    eventType:
      d.key === 'open' ? 'open' : d.key === 'funded' ? 'production' : 'repaid',
    eventLabel: '',
    eventLabelKey: `landing.liveDeals.samples.${d.key}.flowStep`,
    productName: d.product,
    companyLine: d.company,
    amountLabel: d.amount,
    aprLabel: d.apr,
    termDays: Number(d.termDays),
    category: d.category.split(' · ')[0],
    milestonesCompleted: d.milestone === 'repaid' ? 2 : d.milestone === 'funded_progress' ? 2 : 0,
    milestonesTotal: 2,
    isLive: false,
  }))
}

/** Build a long feed for waterfall columns (dedupe by id, pad if needed). */
export function buildLandingFeed(deals: Deal[]): LandingFeedItem[] {
  const source =
    deals.length > 0
      ? deals.map(dealToFeedItem)
      : illustrativeToFeed()

  const unique = Array.from(new Map(source.map((item) => [item.id, item])).values())
  if (unique.length >= 12) return unique

  const padded: LandingFeedItem[] = []
  while (padded.length < 12) {
    padded.push(...unique.map((item, i) => ({ ...item, id: `${item.id}-p${padded.length + i}` })))
  }
  return padded.slice(0, 18)
}

export function splitIntoColumns<T>(items: T[], columns: number): T[][] {
  const cols: T[][] = Array.from({ length: columns }, () => [])
  items.forEach((item, i) => cols[i % columns].push(item))
  return cols
}

type TranslateFn = (key: string, replacements?: Record<string, string | number>) => string

/** Apply i18n keys to feed items (live status labels + illustrative sample copy). */
export function localizeLandingFeedItem(item: LandingFeedItem, t: TranslateFn): LandingFeedItem {
  const illusMatch = item.id.match(/^illus-(\w+)/)
  if (illusMatch) {
    const sampleKey = illusMatch[1]
    return {
      ...item,
      eventLabel: t(item.eventLabelKey, item.eventLabelParams),
      productName: t(`landing.liveDeals.samples.${sampleKey}.product`),
      companyLine: t(`landing.liveDeals.samples.${sampleKey}.company`),
      category: t(`landing.liveDeals.samples.${sampleKey}.category`),
    }
  }

  return {
    ...item,
    eventLabel: t(item.eventLabelKey, item.eventLabelParams),
  }
}
