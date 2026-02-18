export type DealStatus = 
  | 'awaiting_funding' 
  | 'funded' 
  | 'in_progress' 
  | 'milestone_pending' 
  | 'completed' 
  | 'disputed'
  | 'released'

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
  investorName?: string
  investorAddress?: string
  description?: string
  category?: string
  yieldAPR?: number
}

export interface User {
  id: string
  name: string
  role: UserRole
  walletAddress?: string
  email?: string
}
