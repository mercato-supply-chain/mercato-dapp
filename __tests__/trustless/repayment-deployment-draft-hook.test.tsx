import { describe, expect, test, mock } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { buildRepaymentEscrowDraft, type TrustlessConfigSnapshot } from '@/lib/trustless/repayment-deployment-draft'

const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const ACCOUNT2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const TRUSTLINE = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

const CONFIG: TrustlessConfigSnapshot = {
  network: 'testnet',
  platformAddress: ACCOUNT,
  platformFeePercent: 1,
  trustline: { address: TRUSTLINE, symbol: 'USDC' },
}

mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
  }),
}))
mock.module('@/lib/trustless/repayment-config-snapshot', () => ({
  buildRepaymentConfigSnapshot: () => CONFIG,
}))

import { useRepaymentDeploymentDraft } from '@/hooks/use-repayment-deployment-draft'

function makeItem(overrides: Partial<import('@/lib/admin/types').CreateEscrowItem> = {}): import('@/lib/admin/types').CreateEscrowItem {
  return {
    dealId: 'deal-99',
    dealTitle: 'Test deal',
    dealProductName: 'Test product',
    principal: 10000,
    aprPercent: 10,
    termDays: 90,
    totalGrossed: 0,
    defaultFirstMilestoneAmount: 0,
    investorAddress: ACCOUNT2,
    investorId: 'inv-1',
    investorName: 'Investor',
    profit: 1000,
    netTarget: 11000,
    engagementId: 'deal-99:repayment',
    escrowType: 'multi-release',
    pymeName: 'PyME',
    supplierName: 'Supplier',
    supplierLogoUrl: null,
    ...overrides,
  } as import('@/lib/admin/types').CreateEscrowItem
}

describe('useRepaymentDeploymentDraft', () => {
  test('sync porcentaje → monto y monto → porcentaje', async () => {
    const { result } = renderHook(() => useRepaymentDeploymentDraft({ item: makeItem(), signerAddress: ACCOUNT }))
    act(() => result.current.build())
    const total = result.current.draft!.repayment.totalGrossed
    const startPercent = result.current.percentFromAmount
    expect(startPercent).toBe(50)

    act(() => result.current.patchMilestonePercent(25))
    expect(result.current.draft!.milestones[0].amount).toBeCloseTo(total * 0.25, 2)
    expect(result.current.percentFromAmount).toBe(25)

    act(() => result.current.patchMilestoneAmount(total * 0.6))
    expect(result.current.percentFromAmount).toBe(60)
    expect(result.current.draft!.milestones[0].amount).toBeCloseTo(total * 0.6, 2)
  })

  test('applyOneTimeReceiverOverride con dirección distinta', async () => {
    const { result } = renderHook(() => useRepaymentDeploymentDraft({ item: makeItem(), signerAddress: ACCOUNT }))
    act(() => result.current.build())
    const originalReceiver = result.current.draft!.milestones[0].receiver
    expect(originalReceiver).toBe(ACCOUNT2)
    act(() => result.current.applyReceiverOverride(ACCOUNT))
    expect(result.current.draft!.milestones[0].receiver).toBe(ACCOUNT)
    expect(result.current.draft!.sourceInvestor).toBe(ACCOUNT2)
    expect(result.current.generated!.milestones[0].receiver).toBe(ACCOUNT2)
  })

  test('resetToGenerated restaura valores generados', async () => {
    const { result } = renderHook(() => useRepaymentDeploymentDraft({ item: makeItem(), signerAddress: ACCOUNT }))
    act(() => result.current.build())
    const generatedTitle = result.current.generated!.title
    act(() => result.current.patchTitle('Edited title'))
    expect(result.current.draft!.title).toBe('Edited title')
    act(() => result.current.resetToGenerated())
    expect(result.current.draft!.title).toBe(generatedTitle)
    expect(result.current.draft!.milestones[0].amount).toBe(result.current.generated!.milestones[0].amount)
  })

  test('resetToGenerated tras ediciones múltiples', async () => {
    const { result } = renderHook(() => useRepaymentDeploymentDraft({ item: makeItem(), signerAddress: ACCOUNT }))
    act(() => result.current.build())
    act(() => result.current.patchMilestonePercent(30))
    act(() => result.current.patchTitle('Edited'))
    expect(result.current.draft!.title).toBe('Edited')
    act(() => result.current.resetToGenerated())
    expect(result.current.draft!.title).toBe(result.current.generated!.title)
    expect(result.current.staleFields).toBeNull()
  })
})
