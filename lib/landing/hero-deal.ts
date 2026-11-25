import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import type { Deal } from '@/lib/types'
import { calculateYieldAPR } from '@/lib/yield'

/**
 * The single commercial obligation the landing hero leads with: who buys,
 * who supplies, the invoice amount, and what the investor gets back.
 *
 * Kept as plain serialisable data so the server page can pass it to the
 * client hero without shipping the full `Deal` shape.
 */
export type LandingHeroDeal = {
  /** `live` = an open deal from the marketplace; `sample` = illustrative terms. */
  source: 'live' | 'sample'
  href: string
  /** Short public reference for live deals (e.g. `A1B2C3D4`). */
  reference?: string
  /** Live names. Sample deals leave these unset so the UI can localise them. */
  productName?: string
  buyerName?: string
  supplierName?: string
  quantity: number
  /** Supplier invoice (principal) — paid to the supplier when the deal funds. */
  invoiceAmount: number
  termDays: number
  /** Flat investor rate for the term (not annualised), in percent. */
  ratePercent: number
  investorProfit: number
  /** Principal + yield the investor is repaid at term. */
  investorReceives: number
}

const OPEN_FUNDING_STATUSES = new Set<Deal['fundingStatus']>(['open', 'extended'])

const SAMPLE_INVOICE_AMOUNT = 12_500
const SAMPLE_TERM_DAYS = 60
const SAMPLE_QUANTITY = 1_000

export function sampleHeroDeal(): LandingHeroDeal {
  const ratePercent = calculateYieldAPR(SAMPLE_TERM_DAYS, SAMPLE_INVOICE_AMOUNT)
  const { profit, total } = computeInvestorReturns(
    SAMPLE_INVOICE_AMOUNT,
    ratePercent,
    SAMPLE_TERM_DAYS,
  )
  return {
    source: 'sample',
    href: '/deals',
    quantity: SAMPLE_QUANTITY,
    invoiceAmount: SAMPLE_INVOICE_AMOUNT,
    termDays: SAMPLE_TERM_DAYS,
    ratePercent,
    investorProfit: profit,
    investorReceives: total,
  }
}

/** Map a marketplace deal to hero terms, or `null` when it cannot be shown honestly. */
export function heroDealFromDeal(deal: Deal): LandingHeroDeal | null {
  if (deal.status !== 'awaiting_funding') return null
  if (!OPEN_FUNDING_STATUSES.has(deal.fundingStatus)) return null

  const invoiceAmount = Number(deal.priceUSDC)
  const termDays = Number(deal.term)
  const ratePercent = Number(deal.yieldAPR ?? 0)
  if (!(invoiceAmount > 0) || !(termDays > 0) || !(ratePercent > 0)) return null

  const { profit, total } = computeInvestorReturns(invoiceAmount, ratePercent, termDays)

  return {
    source: 'live',
    href: `/deals/${deal.id}`,
    reference: deal.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
    productName: deal.productName,
    buyerName: deal.pymeName,
    supplierName: deal.supplier,
    quantity: Math.max(0, Number(deal.quantity) || 0),
    invoiceAmount,
    termDays,
    ratePercent,
    investorProfit: profit,
    investorReceives: total,
  }
}

/** First deal that is open for funding, else illustrative terms. */
export function pickHeroDeal(deals: readonly Deal[]): LandingHeroDeal {
  for (const deal of deals) {
    const hero = heroDealFromDeal(deal)
    if (hero) return hero
  }
  return sampleHeroDeal()
}
