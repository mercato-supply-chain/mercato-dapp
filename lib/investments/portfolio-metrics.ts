import { normalizeUSDC } from '@/lib/format'
import type {
  AllocationSlice,
  EnrichedInvestorDeal,
  InvestorDeal,
  InvestorPortfolio,
  MaturityEvent,
  PortfolioBucket,
} from './types'

export function expectedYield(amount: number, rate: number, termDays: number): number {
  if (termDays <= 0 || rate <= 0) return 0
  // Flat rate for the deal term (not annualized)
  return normalizeUSDC(amount * (rate / 100))
}

export function accruedYield(amount: number, rate: number, fundedAt: string | null, termDays: number): number {
  if (!fundedAt || termDays <= 0 || rate <= 0) return 0
  const start = new Date(fundedAt).getTime()
  const elapsedMs = Math.max(0, Date.now() - start)
  const daysElapsed = Math.min(termDays, elapsedMs / 86_400_000)
  // Accrue flat term yield proportionally over the deal term
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

export function buildInvestorPortfolio(
  deals: InvestorDeal[],
  openEscrowsBySmb: Record<string, number>,
  displayName: string | null,
  smbFallback: string,
  dealFallbackTitle: string,
): InvestorPortfolio {
  const enriched: EnrichedInvestorDeal[] = deals.map((d) => {
    const amountNum = Number(d.amount)
    const apr = Number(d.interest_rate ?? 0)
    const termDays = Number(d.term_days ?? 0)
    const bucket = bucketForStatus(d.status)
    const progress = termProgress(d.funded_at, d.term_days)
    const yieldAtMaturity = expectedYield(amountNum, apr, termDays)
    const accrued = bucket === 'active' ? accruedYield(amountNum, apr, d.funded_at, termDays) : 0

    return {
      ...d,
      bucket,
      displayTitle: d.product_name || d.title || dealFallbackTitle,
      smbName: smbName(d.pyme, smbFallback),
      amountNum,
      apr,
      termDays,
      expectedYield: yieldAtMaturity,
      accruedYield: accrued,
      termProgress: progress,
      openEscrowsWithSmb: d.pyme_id ? (openEscrowsBySmb[d.pyme_id] ?? 0) : 0,
    }
  })

  const active = enriched.filter((d) => d.bucket === 'active')
  const completed = enriched.filter((d) => d.bucket === 'completed')
  const other = enriched.filter((d) => d.bucket === 'other')

  let totalDeployed = 0
  let activeCapital = 0
  let completedPrincipal = 0
  let pendingYieldAtMaturity = 0
  let accruedYieldTotal = 0
  let realizedYield = 0
  let weightedAprNumerator = 0

  for (const d of enriched) {
    totalDeployed += d.amountNum
    if (d.bucket === 'active') {
      activeCapital += d.amountNum
      pendingYieldAtMaturity += d.expectedYield
      accruedYieldTotal += d.accruedYield
      weightedAprNumerator += d.amountNum * d.apr
    } else if (d.bucket === 'completed') {
      completedPrincipal += d.amountNum
      realizedYield += d.expectedYield
    }
  }

  const weightedApr = activeCapital > 0 ? weightedAprNumerator / activeCapital : 0
  const netReturnPercent =
    completedPrincipal > 0 ? (realizedYield / completedPrincipal) * 100 : 0

  const allocation = buildAllocation(active)
  const maturities = buildMaturityEvents(active)

  return {
    deals: enriched,
    active,
    completed,
    other,
    metrics: {
      totalDeployed,
      activeCapital,
      completedPrincipal,
      pendingYieldAtMaturity,
      accruedYield: accruedYieldTotal,
      realizedYield,
      weightedApr,
      netReturnPercent,
      dealCount: enriched.length,
      activeCount: active.length,
      completedCount: completed.length,
    },
    allocation,
    maturities,
    openEscrowsBySmb,
    displayName,
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
