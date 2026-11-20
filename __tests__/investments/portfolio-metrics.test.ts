import { describe, expect, test } from 'bun:test'
import { buildInvestorPortfolio } from '@/lib/investments/portfolio-metrics'
import type { InvestorDeal } from '@/lib/investments/types'

function makeDeal(overrides: Partial<InvestorDeal> = {}): InvestorDeal {
  return {
    id: overrides.id ?? 'deal-1',
    title: 'Test Deal',
    product_name: 'Widgets',
    status: 'funded',
    amount: 10_000,
    contribution_amount: null,
    interest_rate: 5,
    term_days: 30,
    created_at: '2026-01-01T00:00:00Z',
    funded_at: '2026-01-01T00:00:00Z',
    pyme_id: 'pyme-1',
    escrow_contract_address: null,
    pyme: { company_name: 'Test PyME' },
    ...overrides,
  }
}

function baseSummary(overrides: Record<string, unknown> = {}) {
  return {
    total_deployed: 500_000,
    active_capital: 100_000,
    completed_principal: 400_000,
    pending_yield_at_maturity: 5_000,
    accrued_yield: 2_000,
    realized_yield: 20_000,
    weighted_apr: 5,
    deal_count: 250,
    active_count: 3,
    completed_count: 247,
    open_escrows_by_smb: { 'pyme-1': 4 },
    ...overrides,
  }
}

describe('buildInvestorPortfolio', () => {
  test('KPI totals reflect the DB summary, independent of the fetched history page', () => {
    const portfolio = buildInvestorPortfolio({
      activeDeals: [makeDeal({ status: 'funded', pyme_id: 'pyme-1' })],
      historyDeals: [makeDeal({ id: 'deal-2', status: 'completed' })], // only 1 of 247 fetched
      historyTotal: 247,
      page: 1,
      pageSize: 10,
      summary: baseSummary(),
      displayName: 'Test',
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    expect(portfolio.metrics.dealCount).toBe(250) // full-history count, not page size
    expect(portfolio.metrics.completedPrincipal).toBe(400_000)
    expect(portfolio.active[0].openEscrowsWithSmb).toBe(4) // grouped count, not fetched rows
    expect(portfolio.metrics.netReturnPercent).toBeCloseTo((20_000 / 400_000) * 100)
  })

  test('hasMore is true when more history pages remain', () => {
    const portfolio = buildInvestorPortfolio({
      activeDeals: [],
      historyDeals: [makeDeal({ status: 'completed' })],
      historyTotal: 35,
      page: 1,
      pageSize: 10,
      summary: baseSummary({ deal_count: 35, active_count: 0, completed_count: 35 }),
      displayName: null,
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    expect(portfolio.history.hasMore).toBe(true)
  })

  test('hasMore is false on the last page', () => {
    const portfolio = buildInvestorPortfolio({
      activeDeals: [],
      historyDeals: [makeDeal({ status: 'completed' })],
      historyTotal: 35,
      page: 4,
      pageSize: 10,
      summary: baseSummary({ deal_count: 35, active_count: 0, completed_count: 35 }),
      displayName: null,
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    expect(portfolio.history.hasMore).toBe(false)
  })

  test('open escrow counts come entirely from the grouped summary, not fetched deal rows', () => {
    const portfolio = buildInvestorPortfolio({
      activeDeals: [
        makeDeal({ id: 'a1', pyme_id: 'pyme-1' }),
        makeDeal({ id: 'a2', pyme_id: 'pyme-2' }),
      ],
      historyDeals: [],
      historyTotal: 0,
      page: 1,
      pageSize: 10,
      summary: baseSummary({ open_escrows_by_smb: { 'pyme-1': 4, 'pyme-2': 1 } }),
      displayName: null,
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    expect(portfolio.active.find((d) => d.pyme_id === 'pyme-1')?.openEscrowsWithSmb).toBe(4)
    expect(portfolio.active.find((d) => d.pyme_id === 'pyme-2')?.openEscrowsWithSmb).toBe(1)
  })
})

// ─── Partial contribution / per-investor accuracy tests ─────────────────────

describe('per-investor partial contribution (issue #249)', () => {
  /**
   * Core acceptance criterion:
   * With a 1,000 principal asset, A=600 and B=400:
   * - Investor A sees amountNum = 600
   * - Investor B sees amountNum = 400
   * - Platform-wide principal stays 1,000 (from summary)
   */
  test('investor A with contribution_amount=600 on 1000 deal sees exposure of 600', () => {
    const portfolio = buildInvestorPortfolio({
      activeDeals: [
        makeDeal({ id: 'deal-1', amount: 1_000, contribution_amount: 600 }),
      ],
      historyDeals: [],
      historyTotal: 0,
      page: 1,
      pageSize: 10,
      summary: baseSummary({
        total_deployed: 1_000,
        active_capital: 1_000,
        deal_count: 1,
        active_count: 1,
        completed_count: 0,
      }),
      displayName: 'Investor A',
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    const deal = portfolio.active[0]
    expect(deal.amountNum).toBe(600)
    expect(deal.shareOfDeal).toBeCloseTo(0.6)
  })

  test('investor B with contribution_amount=400 on 1000 deal sees exposure of 400', () => {
    const portfolio = buildInvestorPortfolio({
      activeDeals: [
        makeDeal({ id: 'deal-1', amount: 1_000, contribution_amount: 400 }),
      ],
      historyDeals: [],
      historyTotal: 0,
      page: 1,
      pageSize: 10,
      summary: baseSummary({
        total_deployed: 1_000,
        active_capital: 1_000,
        deal_count: 1,
        active_count: 1,
        completed_count: 0,
      }),
      displayName: 'Investor B',
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    const deal = portfolio.active[0]
    expect(deal.amountNum).toBe(400)
    expect(deal.shareOfDeal).toBeCloseTo(0.4)
  })

  test('platform-wide metrics come from summary (always 1000), not per-investor deal rows', () => {
    // Investor A only fetches their 600 contribution, but platform summary is 1000
    const portfolio = buildInvestorPortfolio({
      activeDeals: [
        makeDeal({ id: 'deal-1', amount: 1_000, contribution_amount: 600 }),
      ],
      historyDeals: [],
      historyTotal: 0,
      page: 1,
      pageSize: 10,
      summary: baseSummary({
        total_deployed: 1_000,
        active_capital: 1_000,
        deal_count: 1,
        active_count: 1,
        completed_count: 0,
      }),
      displayName: 'Investor A',
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    // Investor's per-deal exposure is 600
    expect(portfolio.active[0].amountNum).toBe(600)
    // But platform-wide deployed capital from summary is 1000
    expect(portfolio.metrics.totalDeployed).toBe(1_000)
  })

  test('legacy deal without contribution_amount falls back to full amount', () => {
    const portfolio = buildInvestorPortfolio({
      activeDeals: [
        makeDeal({ id: 'deal-1', amount: 10_000, contribution_amount: null }),
      ],
      historyDeals: [],
      historyTotal: 0,
      page: 1,
      pageSize: 10,
      summary: baseSummary(),
      displayName: null,
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    const deal = portfolio.active[0]
    // Legacy single-investor deal: amountNum falls back to full amount
    expect(deal.amountNum).toBe(10_000)
    // Share is 100% for a legacy full-fund deal
    expect(deal.shareOfDeal).toBeCloseTo(1.0)
  })

  test('expectedYield is computed on contribution_amount, not full deal amount', () => {
    // 600 USDC at 5% APR for 30 days
    const principal = 600
    const rate = 5
    const termDays = 30
    // expectedYield = principal * (rate/100) = 600 * 0.05 = 30 (normalized to 7dp)
    const expectedReturn = Math.round(principal * (rate / 100) * 1e7) / 1e7

    const portfolio = buildInvestorPortfolio({
      activeDeals: [
        makeDeal({
          id: 'deal-1',
          amount: 1_000,
          contribution_amount: principal,
          interest_rate: rate,
          term_days: termDays,
        }),
      ],
      historyDeals: [],
      historyTotal: 0,
      page: 1,
      pageSize: 10,
      summary: baseSummary(),
      displayName: null,
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    expect(portfolio.active[0].expectedYield).toBeCloseTo(expectedReturn, 4)
  })

  test('allocation slices use contribution_amount for percent calculation', () => {
    const portfolio = buildInvestorPortfolio({
      activeDeals: [
        makeDeal({ id: 'd1', amount: 1_000, contribution_amount: 600, pyme_id: 'pyme-1' }),
        makeDeal({ id: 'd2', amount: 2_000, contribution_amount: 200, pyme_id: 'pyme-2' }),
      ],
      historyDeals: [],
      historyTotal: 0,
      page: 1,
      pageSize: 10,
      summary: baseSummary({
        open_escrows_by_smb: { 'pyme-1': 1, 'pyme-2': 1 },
      }),
      displayName: null,
      smbFallback: 'SMB',
      dealFallbackTitle: 'Deal',
    })

    // Total investor exposure = 600 + 200 = 800
    const total = 800
    const pyme1Slice = portfolio.allocation.find((s) => s.id === 'pyme-1')
    const pyme2Slice = portfolio.allocation.find((s) => s.id === 'pyme-2')

    expect(pyme1Slice?.amount).toBe(600)
    expect(pyme2Slice?.amount).toBe(200)
    expect(pyme1Slice?.percent).toBeCloseTo((600 / total) * 100)
    expect(pyme2Slice?.percent).toBeCloseTo((200 / total) * 100)
  })
})
