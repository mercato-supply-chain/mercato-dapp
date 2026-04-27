export type DealStatus = 
  | 'awaiting_funding' 
  | 'funded' 
  | 'in_progress' 
  | 'milestone_pending' 
  | 'completed' 
  | 'disputed'
  | 'released'

export type FundingStatus = 'open' | 'funded' | 'expired' | 'extended'

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
  priceUSDC: number
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
  escrowAddress?: string
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

/**
 * Standardized model for representing capital distribution across the platform.
 * Used for tracking liquidity, exposure, and settlement state.
 */
export interface CapitalState {
  /** The currency code (e.g., "USDC") */
  assetCode: string
  /** Total capital under management/committed by investors */
  totalCapital: number
  /** Capital currently locked in active escrow contracts */
  lockedCapital: number
  /** Capital available for new deals (committed but not deployed) */
  availableCapital: number
  /** Total capital successfully released/paid to suppliers */
  releasedCapital: number
  /** Optional: timestamp of the last state update */
  updatedAt?: string
}
