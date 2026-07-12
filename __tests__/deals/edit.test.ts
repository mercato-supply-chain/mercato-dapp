import { describe, expect, test } from 'bun:test'
import {
  canEditDeal,
  dealToFormData,
  findCatalogProductForDeal,
  isDealUnfunded,
} from '@/lib/deals/edit'
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

describe('isDealUnfunded', () => {
  test('open awaiting_funding deal is unfunded', () => {
    expect(isDealUnfunded(baseDeal())).toBe(true)
  })

  test('expired unfunded deal is still editable', () => {
    expect(isDealUnfunded(baseDeal({ fundingStatus: 'expired' }))).toBe(true)
  })

  test('extended unfunded deal is still editable', () => {
    expect(isDealUnfunded(baseDeal({ fundingStatus: 'extended', extensionCount: 1 }))).toBe(true)
  })

  test('funded status blocks edit', () => {
    expect(
      isDealUnfunded(
        baseDeal({
          status: 'funded',
          fundingStatus: 'funded',
          investorId: 'inv-1',
          fundedAt: '2026-07-10',
        }),
      ),
    ).toBe(false)
  })

  test('investor_id alone blocks edit', () => {
    expect(isDealUnfunded(baseDeal({ investorId: 'inv-1' }))).toBe(false)
  })

  test('fundedAt alone blocks edit', () => {
    expect(isDealUnfunded(baseDeal({ fundedAt: '2026-07-10' }))).toBe(false)
  })

  test('fundingStatus funded blocks edit', () => {
    expect(isDealUnfunded(baseDeal({ fundingStatus: 'funded' }))).toBe(false)
  })
})

describe('canEditDeal', () => {
  test('pyme owner can edit unfunded deal', () => {
    expect(
      canEditDeal(baseDeal(), { userId: 'pyme-1', isPyme: true, isAdmin: false }),
    ).toBe(true)
  })

  test('admin can edit unfunded deal', () => {
    expect(
      canEditDeal(baseDeal(), { userId: 'admin-1', isPyme: false, isAdmin: true }),
    ).toBe(true)
  })

  test('unrelated user cannot edit', () => {
    expect(
      canEditDeal(baseDeal(), { userId: 'other', isPyme: false, isAdmin: false }),
    ).toBe(false)
  })

  test('unauthenticated cannot edit', () => {
    expect(
      canEditDeal(baseDeal(), { userId: null, isPyme: false, isAdmin: false }),
    ).toBe(false)
  })

  test('pyme cannot edit after funding', () => {
    expect(
      canEditDeal(
        baseDeal({
          status: 'funded',
          fundingStatus: 'funded',
          investorId: 'inv-1',
          fundedAt: '2026-07-10',
        }),
        { userId: 'pyme-1', isPyme: true, isAdmin: false },
      ),
    ).toBe(false)
  })

  test('admin cannot edit after funding', () => {
    expect(
      canEditDeal(
        baseDeal({
          status: 'funded',
          fundingStatus: 'funded',
          investorId: 'inv-1',
          fundedAt: '2026-07-10',
        }),
        { userId: 'admin-1', isPyme: false, isAdmin: true },
      ),
    ).toBe(false)
  })
})

describe('dealToFormData', () => {
  const products: SupplierProductRow[] = [
    {
      id: 'prod-1',
      supplier_id: 'sup-1',
      name: 'Coffee beans',
      category: 'food',
      price_per_unit: 50,
      supplier: {
        id: 'sup-1',
        company_name: 'Acme Supply',
        email: 'ops@acme.test',
      },
    },
  ]

  test('prefills form from deal and matched catalog product', () => {
    const form = dealToFormData(baseDeal(), products)
    expect(form.productId).toBe('prod-1')
    expect(form.supplierId).toBe('sup-1')
    expect(form.quantity).toBe('100')
    expect(form.term).toBe('60')
    expect(form.fundingWindowDays).toBe('7')
    expect(form.supplierContact).toBe('ops@acme.test')
    expect(form.category).toBe('food')
  })

  test('leaves productId empty when catalog match missing', () => {
    const form = dealToFormData(baseDeal({ productName: 'Unknown SKU' }), products)
    expect(form.productId).toBe('')
    expect(findCatalogProductForDeal(baseDeal({ productName: 'Unknown SKU' }), products)).toBeUndefined()
  })
})
