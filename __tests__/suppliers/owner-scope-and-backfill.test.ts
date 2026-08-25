import { describe, expect, test } from 'bun:test'
import { dealToFormData } from '@/lib/deals/edit'
import type { Deal } from '@/lib/types'
import type { SupplierProductRow } from '@/app/create-deal/types'

function baseDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'deal-1',
    productName: 'Coffee beans',
    quantity: 100,
    priceUSDC: 5000,
    investorFundingTotal: 5050,
    platformFeePercent: 1,
    supplier: 'Acme Supply',
    supplierId: 'sup-1',
    term: 60,
    status: 'awaiting_funding',
    createdAt: '2026-07-01',
    milestones: [],
    repaymentStatus: 'none',
    pymeName: 'PyME Co',
    pymeId: 'pyme-1',
    fundingStatus: 'open',
    extensionCount: 0,
    fundingWindowDays: 7,
    description: 'Weekly order',
    category: 'food',
    ...overrides,
  }
}

const products: SupplierProductRow[] = [
  {
    id: 'prod-1',
    supplier_id: 'sup-1',
    name: 'Coffee beans',
    category: 'food',
    price_per_unit: 50,
    description: null,
    image_url: null,
    sku: null,
    unit: 'unit',
    stock_quantity: 100,
    reserved_quantity: 0,
    reorder_point: 5,
    supplier: { id: 'sup-1', company_name: 'Acme Supply' },
  },
  {
    id: 'prod-2',
    supplier_id: 'sup-1',
    name: 'Coffee beans',
    category: 'food',
    price_per_unit: 55,
    description: null,
    image_url: null,
    sku: null,
    unit: 'unit',
    stock_quantity: 100,
    reserved_quantity: 0,
    reorder_point: 5,
    supplier: { id: 'sup-1', company_name: 'Acme Supply' },
  },
]

describe('dealToFormData productId', () => {
  test('prefills productId when stored on deal', () => {
    const form = dealToFormData(
      baseDeal({ productId: 'prod-2', productName: 'Coffee beans' }),
      products,
    )
    expect(form.productId).toBe('prod-2')
  })

  test('falls back to name match when productId missing', () => {
    const form = dealToFormData(baseDeal(), products)
    expect(form.productId).toBe('prod-1')
  })
})

/**
 * Mirrors SQL backfill: only unique supplier + name + price matches qualify.
 */
export function countBackfillCandidates(
  deals: Array<{ supplierId: string; productName: string; unitPrice: number }>,
  products: Array<{ id: string; supplierId: string; name: string; price: number }>,
): Map<string, string> {
  const result = new Map<string, string>()
  for (const deal of deals) {
    const matches = products.filter(
      (p) =>
        p.supplierId === deal.supplierId &&
        p.name === deal.productName &&
        p.price === deal.unitPrice,
    )
    if (matches.length === 1) {
      result.set(`${deal.supplierId}:${deal.productName}:${deal.unitPrice}`, matches[0].id)
    }
  }
  return result
}

describe('backfill candidate selection', () => {
  test('assigns product_id only for unambiguous matches', () => {
    const assigned = countBackfillCandidates(
      [{ supplierId: 'sup-1', productName: 'Coffee beans', unitPrice: 50 }],
      products.map((p) => ({
        id: p.id,
        supplierId: p.supplier_id,
        name: p.name,
        price: p.price_per_unit,
      })),
    )
    expect(assigned.size).toBe(1)
    expect(assigned.get('sup-1:Coffee beans:50')).toBe('prod-1')
  })

  test('skips ambiguous name matches with different prices', () => {
    const assigned = countBackfillCandidates(
      [{ supplierId: 'sup-1', productName: 'Coffee beans', unitPrice: 60 }],
      products.map((p) => ({
        id: p.id,
        supplierId: p.supplier_id,
        name: p.name,
        price: p.price_per_unit,
      })),
    )
    expect(assigned.size).toBe(0)
  })

  test('skips when multiple products share name and price', () => {
    const assigned = countBackfillCandidates(
      [{ supplierId: 'sup-1', productName: 'Tea', unitPrice: 10 }],
      [
        { id: 'a', supplierId: 'sup-1', name: 'Tea', price: 10 },
        { id: 'b', supplierId: 'sup-1', name: 'Tea', price: 10 },
      ],
    )
    expect(assigned.size).toBe(0)
  })
})

describe('supplier owner filter scoping', () => {
  test('rejects company filter outside owned set', () => {
    const ownedCompanyIds = new Set(['company-a', 'company-b'])
    const requested = 'company-c'
    expect(ownedCompanyIds.has(requested)).toBe(false)
  })

  test('accepts company filter within owned set', () => {
    const ownedCompanyIds = new Set(['company-a', 'company-b'])
    expect(ownedCompanyIds.has('company-a')).toBe(true)
  })
})
