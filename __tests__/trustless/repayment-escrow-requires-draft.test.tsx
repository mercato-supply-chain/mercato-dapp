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

const CONFIG: TrustlessConfigSnapshot = {
  network: 'testnet',
  platformAddress: ACCOUNT,
  platformFeePercent: 1,
  trustline: { address: CONTRACT_ID, symbol: 'USDC' },
}

const LEGACY_ERROR = 'Repayment escrow deployment requires a reviewed draft — direct params deployment is disabled for admin review compliance (#163)'

describe('deployRepaymentEscrow requires draft (#163)', () => {
  beforeEach(() => {
    mockDeployEscrow.mockClear()
    mockRevalidate.mockClear()
    mockGetEscrowsBySigner.mockClear()
  })

  test('lanza error explícito si se llama sin draft (legacy path bloqueado)', async () => {
    const { result } = renderHook(() => useRepaymentEscrow())

    let error: unknown
    try {
      await act(async () => {
        await result.current.deployRepaymentEscrow({
          dealId: 'deal-legacy',
          adminAddress: ACCOUNT,
          provider: null,
          // no draft
          principal: 1000,
          aprPercent: 10,
          termDays: 30,
          productName: 'Prod',
        } as unknown as Parameters<typeof result.current.deployRepaymentEscrow>[0])
      })
    } catch (e) {
      error = e
    }

    expect(error).toBeDefined()
    expect((error as Error).message).toBe(LEGACY_ERROR)
    expect(mockDeployEscrow).not.toHaveBeenCalled()
    expect(mockRevalidate).not.toHaveBeenCalled()
  })

  test('con draft válido sigue el flujo de review (no lanza legacy error, llama deployEscrow)', async () => {
    const { result } = renderHook(() => useRepaymentEscrow())
    const draft = buildRepaymentEscrowDraft(
      {
        dealId: 'deal-ok',
        productName: 'Prod',
        principal: 1000,
        aprPercent: 10,
        termDays: 30,
        investorAddress: ACCOUNT2,
        signerChannel: ACCOUNT,
      },
      CONFIG,
    )

    let error: unknown
    let res: unknown
    try {
      await act(async () => {
        res = await result.current.deployRepaymentEscrow({
          dealId: 'deal-ok',
          adminAddress: ACCOUNT,
          provider: null,
          draft,
          termDays: 30,
        } as unknown as Parameters<typeof result.current.deployRepaymentEscrow>[0])
      })
    } catch (e) {
      error = e
    }

    // No debe ser el error legacy
    if (error) {
      expect((error as Error).message).not.toBe(LEGACY_ERROR)
    } else {
      expect(res).toBeDefined()
      expect((res as { contractId: string }).contractId).toBe('C-test')
      expect(mockRevalidate).toHaveBeenCalled()
      expect(mockDeployEscrow).toHaveBeenCalled()
    }
  })
})
