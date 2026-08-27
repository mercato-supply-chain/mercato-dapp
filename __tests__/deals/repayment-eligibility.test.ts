import { describe, expect, test } from 'bun:test'
import {
  canFund,
  canRelease,
  canAddMilestone,
  computeRepaymentState,
  FUNDABLE_STATUSES,
} from '@/lib/deals/repayment-eligibility'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import type { RepaymentMilestoneCache } from '@/lib/types'

const openMilestone: RepaymentMilestoneCache = {
  index: 0,
  description: 'M1',
  amount: 100,
  released: false,
}

const baseDeal = {
  id: 'deal-1',
  productName: 'Test',
  quantity: 1,
  priceUSDC: 1000,
  supplier: 'S',
  supplierAddress: 'G...',
  term: 30,
  status: 'funded' as const,
  fundingStatus: 'funded' as const,
  extensionCount: 0,
  createdAt: '2026-01-01',
  milestones: [],
  pymeName: 'P',
  yieldAPR: 10,
  escrowAddress: 'CESCA...',
  repaymentStatus: 'escrow_initialized' as const,
  repaymentMilestones: [openMilestone],
}

describe('repayment eligibility', () => {
  test('FUNDABLE_STATUSES includes legacy funded', () => {
    expect(FUNDABLE_STATUSES.has('funded')).toBe(true)
    expect(FUNDABLE_STATUSES.has('ready_to_release')).toBe(true)
  })

  test('canFund requires PyME, escrow address, and fundable status', () => {
    expect(canFund(true, 'CESCA...', 'escrow_initialized')).toBe(true)
    expect(canFund(false, 'CESCA...', 'escrow_initialized')).toBe(false)
    expect(canFund(true, undefined, 'escrow_initialized')).toBe(false)
    expect(canFund(true, 'CESCA...', 'order_confirmed')).toBe(false)
  })

  test('canRelease allows admin and platform wallet only', () => {
    expect(
      canRelease(true, 'GUSER...', 'CESCA...', openMilestone, 'ready_to_release'),
    ).toBe(true)
    expect(
      canRelease(
        false,
        MERCATO_PLATFORM_ADDRESS,
        'CESCA...',
        openMilestone,
        'ready_to_release',
      ),
    ).toBe(true)
    expect(
      canRelease(false, 'GPYME...', 'CESCA...', openMilestone, 'ready_to_release'),
    ).toBe(false)
    expect(
      canRelease(true, 'GUSER...', 'CESCA...', undefined, 'ready_to_release'),
    ).toBe(false)
    expect(
      canRelease(true, 'GUSER...', 'CESCA...', openMilestone, 'funding'),
    ).toBe(false)
  })

  test('canRelease accepts legacy funded status', () => {
    expect(
      canRelease(true, 'GUSER...', 'CESCA...', openMilestone, 'funded'),
    ).toBe(true)
  })

  test('canAddMilestone requires admin/platform, escrow, and remaining schedule', () => {
    expect(canAddMilestone(true, 'GUSER...', 'CESCA...', 50, 'partially_released')).toBe(
      true,
    )
    expect(canAddMilestone(false, 'GPYME...', 'CESCA...', 50, 'partially_released')).toBe(
      false,
    )
    expect(canAddMilestone(true, 'GUSER...', 'CESCA...', 0, 'partially_released')).toBe(
      false,
    )
    expect(canAddMilestone(true, 'GUSER...', 'CESCA...', 50, 'order_confirmed')).toBe(
      false,
    )
  })

  test('computeRepaymentState maps funded display status to ready_to_release', () => {
    const state = computeRepaymentState({
      ...baseDeal,
      repaymentStatus: 'funded',
    })
    expect(state.status).toBe('funded')
    expect(state.displayStatus).toBe('ready_to_release')
  })
})
