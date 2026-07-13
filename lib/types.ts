export type TxState = 'idle' | 'loading' | 'pending' | 'success' | 'error'

export type DealStatus =
  | 'awaiting_funding' 
  | 'funded' 
  | 'in_progress' 
  | 'milestone_pending' 
  | 'completed' 
  | 'disputed'
  | 'released'

export type FundingStatus = 'open' | 'funded' | 'expired' | 'extended'

/**
 * Repayment escrow lifecycle (Trustless Work multi-release).
 * Legacy `funded` is retained for rows created under the single-release flow.
 */
export type RepaymentStatus =
  | 'none'
  | 'order_confirmed'
  | 'escrow_initialized'
  | 'funding'
  | 'ready_to_release'
  | 'partially_released'
  | 'released'
  | 'funded'

/** Cached multi-release repayment milestone (mirrors TW indexer). */
export interface RepaymentMilestoneCache {
  index: number
  description: string
  amount: number
  released: boolean
}

export type UserRole = 'pyme' | 'investor' | 'supplier' | 'admin'

export interface Milestone {
  id: string
  name: string
  percentage: number
  status: 'pending' | 'in_progress' | 'completed' | 'disputed'
  completedAt?: string
  evidence?: string[]
  proofNotes?: string
  proofDocumentUrl?: string
}

export interface Deal {
  id: string
  productName: string
  quantity: number
  /** Supplier invoice / principal (what supplier receives; yield base). */
  priceUSDC: number
  /** Total investor pays at funding: principal + 1% platform fee. */
  investorFundingTotal: number
  /** Platform fee percent (e.g. 1). */
  platformFeePercent: number
  supplier: string
  supplierId?: string
  /** Owner (user) id of the supplier company; used to check "am I the supplier" */
  supplierOwnerId?: string
  supplierAddress?: string
  term: number // days
  status: DealStatus
  createdAt: string
  fundedAt?: string
  completedAt?: string
  milestones: Milestone[]
  /** Repayment escrow contract address (not supplier payment). */
  escrowAddress?: string
  fundingTxHash?: string
  /** Carrier tracking ID from supplier shipment confirmation. */
  trackingId?: string
  /** When supplier confirmed shipment. */
  shippedAt?: string
  /** When SMB confirmed goods received; repayment clock starts here. */
  deliveredAt?: string
  repaymentStatus: RepaymentStatus
  repaymentDueAt?: string
  /** Full grossed repayment target (principal + interest / 0.987). */
  repaymentTotalAmount?: number
  /** Cached TW multi-release repayment milestones. */
  repaymentMilestones?: RepaymentMilestoneCache[]
  pymeName: string
  pymeId?: string
  pymeStakeAmount?: number
  investorName?: string
  investorId?: string
  investorAddress?: string
  description?: string
  category?: string
  yieldAPR?: number
  /** Extra APR (percentage points) offered by PyME on top of the base formula rate */
  yieldBonusApr?: number
  fundingStatus: FundingStatus
  fundingWindowDays?: number
  fundingExpiresAt?: string
  extensionCount: number
  extendedAt?: string
}

export interface User {
  id: string
  name: string
  role: UserRole
  walletAddress?: string
  email?: string
}

export interface CapitalState {
  wallet: number
  inVault: number
  allocated: number
}

export interface Reputation {
  userId: string
  capitalCommitted: number
  dealsCompleted: number
  repaymentPerformance: number
  reputationScore: number
  /** Same as reputationScore, for backward compatibility */
  score: number
  stakeAmount: number
  stakeCurrency: string
  trustLabel: string
  updatedAt: string
}
