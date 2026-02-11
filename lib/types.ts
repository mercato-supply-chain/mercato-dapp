export type DealStatus = 
  | 'awaiting_funding' 
  | 'funded' 
  | 'in_progress' 
  | 'milestone_pending' 
  | 'completed' 
  | 'disputed'
  | 'released'

export type UserRole = 'pyme' | 'investor' | 'supplier'

export interface Milestone {
  id: string
  name: string
  percentage: number
  status: 'pending' | 'completed' | 'disputed'
  completedAt?: string
  evidence?: string[]
}

export interface Deal {
  id: string
  productName: string
  quantity: number
  priceUSDC: number
  supplier: string
  supplierAddress?: string
  term: number // days
  status: DealStatus
  createdAt: string
  fundedAt?: string
  completedAt?: string
  milestones: Milestone[]
  escrowAddress?: string
  pymeName: string
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
