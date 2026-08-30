import { describe, expect, test } from 'bun:test'
import type { PendingApprovalItem } from '@/lib/admin/types'

function findItem(items: PendingApprovalItem[], params: { dealId: string; contractId: string; milestoneIndex: number }): PendingApprovalItem | undefined {
  return items.find((i) => i.dealId === params.dealId && i.escrowContractAddress === params.contractId && i.milestoneIndex === params.milestoneIndex)
}

const ITEMS: PendingApprovalItem[] = [
  { dealId: 'd1', dealTitle: 'Deal 1', dealProductName: 'Prod', dealAmount: 100, escrowContractAddress: 'C1', milestoneId: 'd1:0', milestoneTitle: 'Hito 1', milestoneIndex: 0, milestonePercentage: 50, milestoneAmount: 50, proofNotes: null, proofDocumentUrl: null, pymeName: 'P1', supplierName: 'S1', supplierLogoUrl: null, repaymentStatus: 'funded', remainingToSchedule: 50 } as PendingApprovalItem,
  { dealId: 'd1', dealTitle: 'Deal 1', dealProductName: 'Prod', dealAmount: 100, escrowContractAddress: 'C1', milestoneId: 'd1:1', milestoneTitle: 'Hito 2', milestoneIndex: 1, milestonePercentage: 50, milestoneAmount: 50, proofNotes: null, proofDocumentUrl: null, pymeName: 'P1', supplierName: 'S1', supplierLogoUrl: null, repaymentStatus: 'funded', remainingToSchedule: 0 } as PendingApprovalItem,
  { dealId: 'd2', dealTitle: 'Deal 2', dealProductName: 'Prod2', dealAmount: 200, escrowContractAddress: 'C2', milestoneId: 'd2:0', milestoneTitle: 'Hito C2', milestoneIndex: 0, milestonePercentage: 100, milestoneAmount: 200, proofNotes: null, proofDocumentUrl: null, pymeName: 'P2', supplierName: 'S2', supplierLogoUrl: null, repaymentStatus: 'funded', remainingToSchedule: 0 } as PendingApprovalItem,
]

describe('handleApproveOnly / handleReleaseOnly item lookup', () => {
  test('encuentra el item correcto por dealId/contractId/milestoneIndex', () => {
    expect(findItem(ITEMS, { dealId: 'd1', contractId: 'C1', milestoneIndex: 0 })?.milestoneId).toBe('d1:0')
    expect(findItem(ITEMS, { dealId: 'd1', contractId: 'C1', milestoneIndex: 1 })?.milestoneId).toBe('d1:1')
    expect(findItem(ITEMS, { dealId: 'd2', contractId: 'C2', milestoneIndex: 0 })?.milestoneId).toBe('d2:0')
  })

  test('no encuentra nada si milestoneIndex no coincide', () => {
    expect(findItem(ITEMS, { dealId: 'd1', contractId: 'C1', milestoneIndex: 99 })).toBeUndefined()
  })

  test('no encuentra nada si contractId no coincide', () => {
    expect(findItem(ITEMS, { dealId: 'd1', contractId: 'C9', milestoneIndex: 0 })).toBeUndefined()
  })

  test('handler no explota si find retorna undefined (usa title vacío)', () => {
    const params = { dealId: 'd9', contractId: 'C9', milestoneIndex: 0 }
    const item = findItem(ITEMS, params)
    const title = item?.milestoneTitle ?? ''
    expect(title).toBe('')
    expect(item).toBeUndefined()
  })
})
