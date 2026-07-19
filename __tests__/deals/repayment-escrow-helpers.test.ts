import { describe, expect, test } from 'bun:test'
import {
  repaymentEngagementId,
  roundUsdc,
  isMilestoneReleased,
  cacheMilestonesFromIndexer,
  deriveRepaymentStatusFromMilestones,
} from '@/lib/deals/repayment-escrow-helpers'

describe('repayment escrow helpers', () => {
  test('repaymentEngagementId suffixes the deal id', () => {
    expect(repaymentEngagementId('deal-42')).toBe('deal-42:repayment')
  })

  test('roundUsdc rounds to 2 decimals', () => {
    expect(roundUsdc(1.234)).toBe(1.23)
    expect(roundUsdc(1.235)).toBe(1.24)
    expect(roundUsdc(10)).toBe(10)
  })

  test('isMilestoneReleased reads flags and status', () => {
    expect(isMilestoneReleased(undefined)).toBe(false)
    expect(isMilestoneReleased({ flags: { released: true } } as never)).toBe(true)
    expect(isMilestoneReleased({ status: 'RELEASED' } as never)).toBe(true)
    expect(isMilestoneReleased({ status: 'completed' } as never)).toBe(true)
    expect(isMilestoneReleased({ status: 'pending' } as never)).toBe(false)
    expect(isMilestoneReleased({} as never)).toBe(false)
  })

  test('cacheMilestonesFromIndexer maps indexer milestones', () => {
    expect(cacheMilestonesFromIndexer(null)).toEqual([])
    expect(cacheMilestonesFromIndexer({ milestones: [] } as never)).toEqual([])
    const cache = cacheMilestonesFromIndexer({
      milestones: [
        { description: 'M1', amount: 100, flags: { released: true } },
        { amount: 50, status: 'pending' },
      ],
    } as never)
    expect(cache).toEqual([
      { index: 0, description: 'M1', amount: 100, released: true },
      { index: 1, description: 'Milestone 2', amount: 50, released: false },
    ])
  })

  test('deriveRepaymentStatusFromMilestones covers each state', () => {
    expect(deriveRepaymentStatusFromMilestones([], 0)).toBe('escrow_initialized')

    // all released, nothing remaining to schedule -> released
    expect(
      deriveRepaymentStatusFromMilestones(
        [{ index: 0, description: 'M1', amount: 100, released: true }],
        0,
        100,
      ),
    ).toBe('released')

    // all released but grossed total leaves a remainder -> partially_released
    expect(
      deriveRepaymentStatusFromMilestones(
        [{ index: 0, description: 'M1', amount: 50, released: true }],
        0,
        100,
      ),
    ).toBe('partially_released')

    // open milestone fully covered by balance -> ready_to_release
    expect(
      deriveRepaymentStatusFromMilestones(
        [{ index: 0, description: 'M1', amount: 100, released: false }],
        100,
      ),
    ).toBe('ready_to_release')

    // partial balance, nothing releasable yet -> funding
    expect(
      deriveRepaymentStatusFromMilestones(
        [{ index: 0, description: 'M1', amount: 100, released: false }],
        40,
      ),
    ).toBe('funding')

    // no balance, unreleased only -> escrow_initialized
    expect(
      deriveRepaymentStatusFromMilestones(
        [{ index: 0, description: 'M1', amount: 100, released: false }],
        0,
      ),
    ).toBe('escrow_initialized')

    // one released, one open, no balance -> partially_released
    expect(
      deriveRepaymentStatusFromMilestones(
        [
          { index: 0, description: 'M1', amount: 100, released: true },
          { index: 1, description: 'M2', amount: 100, released: false },
        ],
        0,
      ),
    ).toBe('partially_released')
  })
})
