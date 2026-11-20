import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { Deal } from '@/lib/types'

const reputationReads: string[] = []
const mockGetReputation = mock(async (_supabase: unknown, userId: string) => {
  reputationReads.push(userId)
  return null
})
const mockGetEscrowByContractIds = mock(async () => {
  throw new Error('indexer unavailable')
})
const mockFrom = mock(() => {
  throw new Error('initial server deal should avoid a deal-row refetch')
})

mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: mockFrom,
  }),
}))
mock.module('@/lib/reputation', () => ({ getReputation: mockGetReputation }))
mock.module('@trustless-work/escrow/hooks', () => ({
  useGetEscrowFromIndexerByContractIds: () => ({
    getEscrowByContractIds: mockGetEscrowByContractIds,
  }),
}))
mock.module('@/hooks/use-wallet', () => ({
  useWallet: () => ({
    walletInfo: null,
    isConnected: false,
    handleConnect: async () => {},
  }),
}))

import { useDealDetail } from '@/hooks/use-deal-detail'

const initialDeal: Deal = {
  id: 'deal-1',
  productName: 'Commercial terms',
  quantity: 12,
  priceUSDC: 500,
  investorFundingTotal: 505,
  platformFeePercent: 1,
  supplier: 'Supplier',
  supplierOwnerId: 'supplier-owner',
  term: 30,
  status: 'awaiting_funding',
  createdAt: '2026-01-01',
  milestones: [],
  escrowAddress: 'escrow-contract',
  repaymentStatus: 'none',
  pymeName: 'PyME',
  pymeId: 'pyme-owner',
  fundingStatus: 'open',
  extensionCount: 0,
}

afterEach(() => {
  cleanup()
  reputationReads.length = 0
  mockGetReputation.mockClear()
  mockGetEscrowByContractIds.mockClear()
  mockFrom.mockClear()
})

describe('useDealDetail parallel enrichment reads', () => {
  test('uses the server deal, starts reads together, and keeps terms when indexer fails', async () => {
    const { result } = renderHook(() => useDealDetail(initialDeal.id, initialDeal))

    await waitFor(() => {
      expect(mockGetReputation).toHaveBeenCalledTimes(2)
      expect(mockGetEscrowByContractIds).toHaveBeenCalledTimes(1)
      expect(result.current.partyReputationsLoading).toBe(false)
    })

    expect(reputationReads).toEqual(['pyme-owner', 'supplier-owner'])
    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.deal).toEqual(initialDeal)
    expect(result.current.deal?.priceUSDC).toBe(500)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.indexerEscrow).toBeNull()
  })
})
