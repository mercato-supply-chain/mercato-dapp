import { normalizeUSDC } from '@/lib/format'
import type {
  AllocationSlice,
  EnrichedInvestorDeal,
  InvestorDeal,
  InvestorPortfolio,
  MaturityEvent,
  PortfolioBucket,
  PortfolioMetrics,
} from './types'

export function expectedYield(amount: number, rate: number, termDays: number): number {
  if (termDays <= 0 || rate <= 0) return 0
  return normalizeUSDC(amount * (rate / 100))
}

export function accruedYield(amount: number, rate: number, fundedAt: string | null, termDays: number): number {
  if (!fundedAt || termDays <= 0 || rate <= 0) return 0
  const start = new Date(fundedAt).getTime()
  const elapsedMs = Math.max(0, Date.now() - start)
  const daysElapsed = Math.min(termDays, elapsedMs / 86_400_000)
  return normalizeUSDC(amount * (rate / 100) * (daysElapsed / termDays))
}

export function termProgress(fundedAt: string | null, termDays: number | null): EnrichedInvestorDeal['termProgress'] {
  if (!fundedAt || !termDays || termDays <= 0) {
    return { percent: 0, daysElapsed: 0, daysRemaining: termDays ?? 0, maturityDate: null }
  }
  const start = new Date(fundedAt).getTime()
  const now = Date.now()
  const total = termDays * 86_400_000
  const elapsed = Math.max(0, now - start)
  const daysElapsed = Math.floor(elapsed / 86_400_000)
  const daysRemaining = Math.max(0, termDays - daysElapsed)
  const percent = Math.min(1, elapsed / total)
  const maturityDate = new Date(start + total)
  return { percent, daysElapsed, daysRemaining, maturityDate }
}

export function smbName(
  pyme: InvestorDeal['pyme'],
  fallback: string,
): string {
  return pyme?.company_name || pyme?.full_name || pyme?.contact_name || fallback
}

function bucketForStatus(status: string): PortfolioBucket {
  if (status === 'funded' || status === 'in_progress') return 'active'
  if (status === 'completed') return 'completed'
  return 'other'
}

type RawSummary = {
  total_deployed: number
  active_capital: number
  completed_principal: number
  pending_yield_at_maturity: number
  accrued_yield: number
  realized_yield: number
  weighted_apr: number
  deal_count: number
  active_count: number
  completed_count: number
  open_escrows_by_smb: Record<string, number>
}

function enrichDeal(
  d: InvestorDeal,
  smbFallback: string,
  dealFallbackTitle: string,
  openEscrowsBySmb: Record<string, number>,
): EnrichedInvestorDeal {
  // Use contribution_amount when available to avoid double-counting in
  // multi-investor scenarios. Fall back to amount for legacy single-investor deals.
  const amountNum = Number(d.contribution_amount ?? d.amount)
  const fullDealAmount = Number(d.amount)
  const apr = Number(d.interest_rate ?? 0)
  const termDays = Number(d.term_days ?? 0)
  const bucket = bucketForStatus(d.status)
  const shareOfDeal = fullDealAmount > 0 ? amountNum / fullDealAmount : 1

  return {
    ...d,
    bucket,
    displayTitle: d.product_name || d.title || dealFallbackTitle,
    smbName: smbName(d.pyme, smbFallback),
    amountNum,
    apr,
    termDays,
    expectedYield: expectedYield(amountNum, apr, termDays),
    accruedYield: bucket === 'active' ? accruedYield(amountNum, apr, d.funded_at, termDays) : 0,
    termProgress: termProgress(d.funded_at, d.term_days),
    openEscrowsWithSmb: d.pyme_id ? (openEscrowsBySmb[d.pyme_id] ?? 0) : 0,
    shareOfDeal,
  }
}

export function buildInvestorPortfolio(args: {
  activeDeals: InvestorDeal[]
  historyDeals: InvestorDeal[]
  historyTotal: number
  page: number
  pageSize: number
  summary: RawSummary
  displayName: string | null
  smbFallback: string
  dealFallbackTitle: string
}): InvestorPortfolio {
  const openEscrowsBySmb = args.summary.open_escrows_by_smb ?? {}
  const enrich = (d: InvestorDeal) => enrichDeal(d, args.smbFallback, args.dealFallbackTitle, openEscrowsBySmb)

  const active = args.activeDeals.map(enrich)
  const history = args.historyDeals.map(enrich)
  const completed = history.filter((d) => d.bucket === 'completed')
  const other = history.filter((d) => d.bucket === 'other')

  const s = args.summary
  const metrics: PortfolioMetrics = {
    totalDeployed: Number(s.total_deployed),
    activeCapital: Number(s.active_capital),
    completedPrincipal: Number(s.completed_principal),
    pendingYieldAtMaturity: Number(s.pending_yield_at_maturity),
    accruedYield: Number(s.accrued_yield),
    realizedYield: Number(s.realized_yield),
    weightedApr: Number(s.weighted_apr),
    netReturnPercent:
      Number(s.completed_principal) > 0 ? (Number(s.realized_yield) / Number(s.completed_principal)) * 100 : 0,
    dealCount: s.deal_count,
    activeCount: s.active_count,
    completedCount: s.completed_count,
  }

  return {
    active,
    completed,
    other,
    metrics,
    allocation: buildAllocation(active),
    maturities: buildMaturityEvents(active),
    openEscrowsBySmb,
    displayName: args.displayName,
    history: {
      deals: history,
      page: args.page,
      pageSize: args.pageSize,
      total: args.historyTotal,
      hasMore: args.page * args.pageSize < args.historyTotal,
    },
    rwaPositions: [],
  }
}

function buildAllocation(activeDeals: EnrichedInvestorDeal[]): AllocationSlice[] {
  if (activeDeals.length === 0) return []

  const bySmb = new Map<string, { label: string; amount: number; dealCount: number }>()
  for (const d of activeDeals) {
    const key = d.pyme_id ?? d.smbName
    const existing = bySmb.get(key) ?? { label: d.smbName, amount: 0, dealCount: 0 }
    existing.amount += d.amountNum
    existing.dealCount += 1
    bySmb.set(key, existing)
  }

  const total = activeDeals.reduce((s, d) => s + d.amountNum, 0)
  const sorted = [...bySmb.entries()]
    .map(([id, v]) => ({
      id,
      label: v.label,
      amount: v.amount,
      percent: total > 0 ? (v.amount / total) * 100 : 0,
      dealCount: v.dealCount,
    }))
    .sort((a, b) => b.amount - a.amount)

  const top = sorted.slice(0, 5)
  if (sorted.length > 5) {
    const rest = sorted.slice(5)
    const restAmount = rest.reduce((s, r) => s + r.amount, 0)
    top.push({
      id: '__other__',
      label: 'Other',
      amount: restAmount,
      percent: total > 0 ? (restAmount / total) * 100 : 0,
      dealCount: rest.reduce((s, r) => s + r.dealCount, 0),
    })
  }

  return top
}

function buildMaturityEvents(activeDeals: EnrichedInvestorDeal[]): MaturityEvent[] {
  const now = Date.now()
  const events: MaturityEvent[] = []

  for (const d of activeDeals) {
    const maturity = d.termProgress.maturityDate
    if (!maturity) continue
    const daysUntil = Math.ceil((maturity.getTime() - now) / 86_400_000)
    events.push({
      dealId: d.id,
      title: d.displayTitle,
      smbName: d.smbName,
      principal: d.amountNum,
      expectedYield: d.expectedYield,
      maturityDate: maturity,
      daysUntil,
    })
  }

  return events.sort((a, b) => a.maturityDate.getTime() - b.maturityDate.getTime()).slice(0, 6)
}

export function formatInvestUsd(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
