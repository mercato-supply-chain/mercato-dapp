export type DashboardDealRow = {
  id: string
  title?: string
  product_name?: string
  status: string
  amount: number
  term_days?: number
  interest_rate?: number
  created_at?: string
  funded_at?: string | null
  pyme?: { company_name?: string; full_name?: string; contact_name?: string } | null
  supplier?: { company_name?: string; full_name?: string; contact_name?: string; logo_url?: string | null } | null
  investor?: { company_name?: string; full_name?: string; contact_name?: string } | null
}

export type DashboardQuickAction = {
  label: string
  description: string
  href: string
  icon: string
  variant?: 'primary' | 'default'
}

export type RoleStats = {
  total: number
  active: number
  completed: number
  seekingFunding?: number
  pendingDeliveries?: number
}

export type AdminStats = {
  totalDeals: number
  seekingFunding: number
  activeDeals: number
  completedDeals: number
  /** All milestones in_progress (platform-wide) */
  pendingApprovals: number
  /** in_progress milestones on deals with escrow — operational queue */
  pendingEscrowApprovals: number
  /** completed milestones on escrow deals awaiting on-chain release */
  releaseQueue: number
  escrowDeals: number
  totalVolume: number
  activeVolume: number
  pymeCount: number
  investorCount: number
  supplierCount: number
  supplierCompanyCount: number
  vaultConfigured: boolean
}

export type AdminApprovalPreview = {
  milestoneId: string
  dealId: string
  dealTitle: string
  milestoneTitle: string
  pymeName: string
  supplierName: string
  amount: number
}

export type SupplierProductPreview = {
  id: string
  name: string
  image_url: string | null
}

export type SupplierProductsCard = {
  categories: string[]
  /** Product names for compact badge lists */
  products: string[]
  /** Rich previews with images for dashboard catalog card */
  items: SupplierProductPreview[]
}

export type DashboardProfile = {
  fullName: string
  companyName?: string | null
  userType: string
}

export type DashboardPayload = {
  profile: DashboardProfile
  deals: DashboardDealRow[]
  companyFilterId: string | null
  supplierCompanies: { id: string; company_name: string | null; logo_url: string | null }[]
  supplierProductsForCard: SupplierProductsCard | null
  roleStats: RoleStats | null
  adminStats: AdminStats | null
  adminApprovalPreview: AdminApprovalPreview[]
}
