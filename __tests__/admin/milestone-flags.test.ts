import { describe, expect, test } from 'bun:test'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import {
  getMilestone,
  isMilestoneReleased,
  isMilestoneApproved,
  isMilestoneDisputed,
  canReleaseMilestoneInOrder,
  type MilestoneFlags,
} from '@/lib/admin/milestone-flags'

function escrowWith(milestones: MilestoneFlags[]): GetEscrowsFromIndexerResponse {
  return { milestones } as unknown as GetEscrowsFromIndexerResponse
}

describe('getMilestone', () => {
  test('returns the milestone at the given index', () => {
    const escrow = escrowWith([{ status: 'pending' }, { status: 'released' }])
    expect(getMilestone(escrow, 1)?.status).toBe('released')
  })

  test('returns undefined for a missing escrow or out-of-range index', () => {
    expect(getMilestone(undefined, 0)).toBeUndefined()
    expect(getMilestone(escrowWith([]), 3)).toBeUndefined()
  })
})

describe('isMilestoneReleased', () => {
  test('true via flags.released', () => {
    const escrow = escrowWith([{ flags: { released: true } }])
    expect(isMilestoneReleased(escrow, 0)).toBe(true)
  })

  test('true via legacy top-level released', () => {
    const escrow = escrowWith([{ released: true }])
    expect(isMilestoneReleased(escrow, 0)).toBe(true)
  })

  test('true via status released or completed, case-insensitive', () => {
    expect(isMilestoneReleased(escrowWith([{ status: 'Released' }]), 0)).toBe(true)
    expect(isMilestoneReleased(escrowWith([{ status: 'COMPLETED' }]), 0)).toBe(true)
  })

  test('false when milestone missing or not released', () => {
    expect(isMilestoneReleased(undefined, 0)).toBe(false)
    expect(isMilestoneReleased(escrowWith([{ status: 'pending' }]), 0)).toBe(false)
  })
})

describe('isMilestoneApproved', () => {
  test('true only via explicit flags.approved', () => {
    expect(isMilestoneApproved(escrowWith([{ flags: { approved: true } }]), 0)).toBe(true)
    expect(isMilestoneApproved(escrowWith([{ status: 'approved' }]), 0)).toBe(false)
    expect(isMilestoneApproved(undefined, 0)).toBe(false)
  })
})

describe('isMilestoneDisputed', () => {
  test('true via flags.disputed or status disputed', () => {
    expect(isMilestoneDisputed(escrowWith([{ flags: { disputed: true } }]), 0)).toBe(true)
    expect(isMilestoneDisputed(escrowWith([{ status: 'Disputed' }]), 0)).toBe(true)
  })

  test('resolved disputes are no longer disputed', () => {
    const escrow = escrowWith([{ flags: { disputed: true, resolved: true } }])
    expect(isMilestoneDisputed(escrow, 0)).toBe(false)
  })

  test('false when milestone missing or clean', () => {
    expect(isMilestoneDisputed(undefined, 0)).toBe(false)
    expect(isMilestoneDisputed(escrowWith([{ status: 'pending' }]), 0)).toBe(false)
  })
})

describe('canReleaseMilestoneInOrder', () => {
  const released: MilestoneFlags = { flags: { released: true } }
  const pending: MilestoneFlags = { status: 'pending' }

  test('index 0 is always releasable', () => {
    expect(canReleaseMilestoneInOrder(undefined, 0)).toBe(true)
    expect(canReleaseMilestoneInOrder(escrowWith([pending]), 0)).toBe(true)
  })

  test('releasable only when all prior milestones are released', () => {
    expect(canReleaseMilestoneInOrder(escrowWith([released, pending]), 1)).toBe(true)
    expect(canReleaseMilestoneInOrder(escrowWith([pending, pending]), 1)).toBe(false)
    expect(canReleaseMilestoneInOrder(escrowWith([released, pending, pending]), 2)).toBe(false)
    expect(canReleaseMilestoneInOrder(escrowWith([released, released, pending]), 2)).toBe(true)
  })
})
