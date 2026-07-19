export interface DeployRepaymentParams {
  dealId: string
  /** Platform / admin wallet that signs deploy. */
  adminAddress: string
  investorAddress: string
  principal: number
  aprPercent: number
  termDays: number
  productName: string
  /** Percent of total grossed for the first milestone (default 50). */
  firstMilestonePercent?: number
  provider: string | null
}

export interface FundRepaymentParams {
  dealId: string
  contractId: string
  pymeAddress: string
  amount: number
  provider: string | null
}

export interface ReleaseMilestoneParams {
  dealId: string
  contractId: string
  releaseSigner: string
  milestoneIndex: number
  provider: string | null
}

export interface AddMilestoneParams {
  dealId: string
  contractId: string
  adminAddress: string
  investorAddress: string
  /** Amount for the new milestone; defaults to remaining grossed total. */
  amount?: number
  description?: string
  provider: string | null
}

export interface DisputeMilestoneParams {
  dealId: string
  contractId: string
  signer: string
  milestoneIndex: number
  provider: string | null
}

export interface ResolveDisputeParams {
  dealId: string
  contractId: string
  disputeResolver: string
  milestoneIndex: number
  /** Must sum to the milestone amount (post-fee rules enforced on-chain). */
  distributions: Array<{ address: string; amount: number }>
  provider: string | null
}
