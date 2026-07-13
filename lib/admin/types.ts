/** Deal awaiting admin to create multi-release repayment escrow */
export type CreateEscrowItem = {
  dealId: string
  dealTitle: string
  dealProductName: string | null
  principal: number
  aprPercent: number
  termDays: number
  totalGrossed: number
  defaultFirstMilestoneAmount: number
  investorAddress: string | null
  pymeName: string
  supplierName: string
  supplierLogoUrl: string | null
  createdAt?: string
}

/** Milestone awaiting approval + release */
export type PendingApprovalItem = {
  dealId: string
  dealTitle: string
  dealProductName: string | null
  dealAmount: number
  escrowContractAddress: string
  milestoneId: string
  milestoneTitle: string
  milestoneIndex: number
  milestonePercentage: number
  milestoneAmount: number
  proofNotes: string | null
  proofDocumentUrl: string | null
  pymeName: string
  pymeAddress?: string | null
  supplierName: string
  supplierLogoUrl: string | null
  repaymentStatus?: string | null
  investorAddress?: string | null
  remainingToSchedule?: number
  createdAt?: string
}

/** Completed milestone: admin can trigger release only */
export type ReleaseFallbackItem = {
  dealId: string
  dealTitle: string
  dealProductName: string | null
  escrowContractAddress: string
  milestoneId: string
  milestoneTitle: string
  milestoneIndex: number
  milestoneAmount: number
  milestonePercentage: number
  completedAt: string | null
  supplierLogoUrl: string | null
  investorAddress?: string | null
  pymeAddress?: string | null
}

export type AdminQueueFilters = {
  company?: string | null
  sort?: 'newest' | 'oldest'
}

export type AdminQueueData = {
  items: PendingApprovalItem[]
  createEscrowItems: CreateEscrowItem[]
  releaseFallbackItems: ReleaseFallbackItem[]
  uniquePymes: { id: string; name: string }[]
  uniqueSuppliers: { id: string; name: string }[]
  emptyState: boolean
  companyFilter: string | null
  sortOrder: 'newest' | 'oldest'
}
