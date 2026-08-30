import { describe, expect, test, mock, beforeEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'

const ACCOUNT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
const CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const ACCOUNT2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

const mockDeployEscrow = mock(async () => ({ status: 'SUCCESS' as const, unsignedTransaction: 'xdr' }))
const mockRevalidate = mock(async () => ({ status: 'unchanged' as const }))
const mockGetEscrowsBySigner = mock(async () => [])

mock.module('@/lib/trustless/config', () => ({
  MERCATO_PLATFORM_ADDRESS: ACCOUNT,
  MERCATO_DISPUTE_RESOLVER_ADDRESS: ACCOUNT,
  repaymentEscrowRoles: () => ({
    approver: ACCOUNT,
    serviceProvider: ACCOUNT,
    platformAddress: ACCOUNT,
    releaseSigner: ACCOUNT,
    disputeResolver: ACCOUNT,
  }),
}))
mock.module('@/lib/trustless/trustlines', () => ({
  USDC_TRUSTLINE: { address: CONTRACT_ID, symbol: 'USDC' },
}))

mock.module('@trustless-work/escrow/hooks', () => ({
  useInitializeEscrow: () => ({ deployEscrow: mockDeployEscrow }),
  useSendTransaction: () => ({ sendTransaction: async () => ({ status: 'SUCCESS', contractId: 'C-test' }) }),
  useFundEscrow: () => ({ fundEscrow: async () => ({}) }),
  useApproveMilestone: () => ({ approveMilestone: async () => ({}) }),
  useReleaseFunds: () => ({ releaseFunds: async () => ({}) }),
  useUpdateEscrow: () => ({ updateEscrow: async () => ({}) }),
  useStartDispute: () => ({ startDispute: async () => ({}) }),
  useResolveDispute: () => ({ resolveDispute: async () => ({}) }),
  useGetEscrowsFromIndexerBySigner: () => ({ getEscrowsBySigner: mockGetEscrowsBySigner }),
  useGetEscrowFromIndexerByContractIds: () => ({ getEscrowByContractIds: async () => [] }),
  useGetMultipleEscrowBalances: () => ({ getMultipleBalances: async () => [] }),
}))

mock.module('@/lib/trustless/repayment-deployment-guard', () => ({
  revalidateAuthoritativeState: (...args: unknown[]) => mockRevalidate(...args),
  compareAuthoritativeSnapshot: () => [],
  buildAuthoritativeSnapshot: () => ({}),
}))

mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { repayment_due_at: null, escrow_contract_address: null }, error: null }) }) }),
      update: () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: [{ id: 'x' }], error: null }) }) }) }),
    }),
  }),
}))

mock.module('@/lib/trustless/wallet-kit', () => ({
  signTransaction: async () => 'signedXdr',
}))

import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import { buildRepaymentEscrowDraft } from '@/lib/trustless/repayment-deployment-draft'
import type { TrustlessConfigSnapshot } from '@/lib/trustless/repayment-deployment-draft'
import { buildRepaymentConfigSnapshot } from '@/lib/trustless/repayment-config-snapshot'

const CONFIG: TrustlessConfigSnapshot = {
  network: 'testnet',
  platformAddress: ACCOUNT,
  platformFeePercent: 1,
  trustline: { address: CONTRACT_ID, symbol: 'USDC' },
}

describe('useRepaymentEscrow deploy integration', () => {
  beforeEach(() => {
    mockDeployEscrow.mockClear()
    mockRevalidate.mockClear()
    mockGetEscrowsBySigner.mockClear()
  })

  test('1a-b-c: draft con disputeResolver=C... rechaza con network_mismatch sin llamar deploy ni revalidate', async () => {
    const { result } = renderHook(() => useRepaymentEscrow())
    const draft = buildRepaymentEscrowDraft(
      {
        dealId: 'deal-1',
        productName: 'Prod',
        principal: 1000,
        aprPercent: 10,
        termDays: 30,
        investorAddress: ACCOUNT2,
        signerChannel: ACCOUNT,
      },
      CONFIG,
    )
    const badDraft = {
      ...draft,
      roles: { ...draft.roles, disputeResolver: CONTRACT_ID },
    }

    let error: unknown
    try {
      await act(async () => {
        await result.current.deployRepaymentEscrow({
          dealId: 'deal-1',
          adminAddress: ACCOUNT,
          provider: null,
          draft: badDraft,
          termDays: 30,
        } as unknown as Parameters<typeof result.current.deployRepaymentEscrow>[0])
      })
    } catch (e) {
      error = e
    }

    expect(error).toBeDefined()
    expect((error as Error & { code?: string }).code).toBe('network_mismatch')
    // The hook's roleValidation should block before any external call
    // Our mockRevalidate and mockDeployEscrow should not have been called
    // However, the hook does call revalidate before role validation? Check order: finalValidation -> roleValidation -> platform checks -> revalidate -> deploy
    // So revalidate is after role validation, so if role validation fails, revalidate should NOT be called, and deploy should NOT be called
    // We assert both not called
    expect(mockRevalidate).not.toHaveBeenCalled()
    expect(mockDeployEscrow).not.toHaveBeenCalled()
  })

  test('D4: Promise.all double deploy solo una llega a deployEscrow', async () => {
    // Make deployEscrow delayed to expose race window
    let deployCallCount = 0
    mockDeployEscrow.mockImplementation(async () => {
      deployCallCount++
      await new Promise((r) => setTimeout(r, 50))
      return { status: 'SUCCESS' as const, unsignedTransaction: 'xdr-delayed' }
    })
    // Mock revalidate to be fast
    mockRevalidate.mockImplementation(async () => ({ status: 'unchanged' as const }))

    const { result } = renderHook(() => useRepaymentEscrow())
    const draft = buildRepaymentEscrowDraft(
      {
        dealId: 'deal-race',
        productName: 'Prod',
        principal: 1000,
        aprPercent: 10,
        termDays: 30,
        investorAddress: ACCOUNT2,
        signerChannel: ACCOUNT,
      },
      CONFIG,
    )

    const params = {
      dealId: 'deal-race',
      adminAddress: ACCOUNT,
      provider: null,
      draft,
      termDays: 30,
    } as unknown as Parameters<typeof result.current.deployRepaymentEscrow>[0]

    const results = await Promise.allSettled([
      result.current.deployRepaymentEscrow(params),
      result.current.deployRepaymentEscrow(params),
    ])

    console.log('D4 results:', JSON.stringify(results.map(r => r.status === 'rejected' ? (r as PromiseRejectedResult).reason.message : 'fulfilled'), null, 2))
    console.log('deployCallCount', deployCallCount, 'mockRevalidate calls', mockRevalidate.mock.calls.length)
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length
    const rejected = results.filter((r) => r.status === 'rejected').length
    // One should succeed (or at least reach deploy), the other should reject with lock
    expect(deployCallCount).toBe(1)
    expect(rejected).toBe(1)
    const rejectedReason = (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason as Error
    expect(rejectedReason.message).toMatch(/Deployment already in progress/)
  })
})
