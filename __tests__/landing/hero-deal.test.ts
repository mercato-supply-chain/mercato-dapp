import { describe, expect, test } from 'bun:test'
import { mockDeals } from '../fixtures/mock-deals'
import { heroDealFromDeal, pickHeroDeal, sampleHeroDeal } from '@/lib/landing/hero-deal'
import type { Deal } from '@/lib/types'

const openDeal: Deal = {
  ...mockDeals[0],
  id: '3f2a9c1e-7b44-4d2a-9e10-55aa00bb11cc',
  productName: 'Cotton yarn',
  quantity: 1000,
  priceUSDC: 10_000,
  term: 60,
  yieldAPR: 7.5,
  pymeName: 'Manufacturas del Norte',
  supplier: 'Hilados del Bajío',
  status: 'awaiting_funding',
  fundingStatus: 'open',
}

describe('heroDealFromDeal', () => {
  test('maps an open deal to buyer, supplier, invoice, and investor payout', () => {
    expect(heroDealFromDeal(openDeal)).toEqual({
      source: 'live',
      href: `/deals/${openDeal.id}`,
      reference: '3F2A9C1E',
      productName: 'Cotton yarn',
      buyerName: 'Manufacturas del Norte',
      supplierName: 'Hilados del Bajío',
      quantity: 1000,
      invoiceAmount: 10_000,
      termDays: 60,
      ratePercent: 7.5,
      investorProfit: 750,
      investorReceives: 10_750,
    })
  })

  test('keeps an extended funding window', () => {
    expect(heroDealFromDeal({ ...openDeal, fundingStatus: 'extended' })?.source).toBe('live')
  })

  test.each([
    ['funded status', { status: 'funded', fundingStatus: 'funded' }],
    ['expired window', { fundingStatus: 'expired' }],
    ['zero invoice', { priceUSDC: 0 }],
    ['zero term', { term: 0 }],
    ['missing rate', { yieldAPR: undefined }],
  ] as const)('skips a deal with %s', (_label, patch) => {
    expect(heroDealFromDeal({ ...openDeal, ...patch } as Deal)).toBeNull()
  })

  test('clamps a missing quantity to zero', () => {
    expect(heroDealFromDeal({ ...openDeal, quantity: Number.NaN })?.quantity).toBe(0)
  })
})

describe('pickHeroDeal', () => {
  test('returns the first deal that can be shown', () => {
    const expired = { ...openDeal, id: 'expired', fundingStatus: 'expired' as const }
    expect(pickHeroDeal([expired, openDeal]).href).toBe(`/deals/${openDeal.id}`)
  })

  test('falls back to sample terms when nothing is open', () => {
    expect(pickHeroDeal([])).toEqual(sampleHeroDeal())
    expect(pickHeroDeal([{ ...openDeal, status: 'completed' }]).source).toBe('sample')
  })
})

describe('sampleHeroDeal', () => {
  test('uses the platform rate formula and links to the marketplace', () => {
    const sample = sampleHeroDeal()
    expect(sample.source).toBe('sample')
    expect(sample.href).toBe('/deals')
    expect(sample.reference).toBeUndefined()
    expect(sample.ratePercent).toBe(7.5)
    expect(sample.investorReceives).toBe(sample.invoiceAmount + sample.investorProfit)
  })
})
