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
  /** Investor profile wallet resolved authoritatively server-side; null while unfunded */
  investorAddress: string | null
  investorId: string | null
  investorName: string | null
  /** Computed returns carried into the review payload so UI and guard share one source */
  profit: number
  netTarget: number
  engagementId: string
  escrowType: 'multi-release'
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

/** One actionable item in the admin "needs attention" inbox */
export type AdminTaskType =
  | 'pending_verification'
  | 'incomplete_onboarding'
  | 'create_escrow'
  | 'escrow_awaiting_funding'
  | 'milestone_release'
  | 'disputed_repayment'
  | 'stale_escrow'
  | 'vault_unconfigured'
  | 'vault_alert'

export type AdminTaskPriority = 'critical' | 'high' | 'normal' | 'informational'

export type AdminTask = {
  id: string
  type: AdminTaskType
  priority: AdminTaskPriority
  titleKey: string
  titleParams?: Record<string, string | number>
  entityLabel: string
  /** ISO timestamp of when the underlying condition was created/detected */
  detectedAt: string | null
  /** Age of the condition relative to task derivation time */
  ageMs: number | null
  stateKey: string
  actionKey: string
  href: string
}

export type AdminOverviewSummary = {
  openTasks: number
  escrowsToCreate: number
  milestonesAwaitingApproval: number
  fundsReadyToRelease: number
  releaseQueueCount: number
  pendingVerifications: number
  incompleteOnboardings: number
  activeDeals: number
  activeVolume: number
}

export type AdminOverviewEscrowRef = {
  contractId: string
  dealId: string
  dealTitle: string
}

export type AdminOverviewData = {
  tasks: AdminTask[]
  summary: AdminOverviewSummary
  vaultConfigured: boolean
  /** Active escrows for the live dispute check on the client */
  escrows: AdminOverviewEscrowRef[]
}

/** Row shown in the /dashboard/admin/users table */
export type AdminUserListItem = {
  id: string
  email: string
  userType: string | null
  companyName: string | null
  fullName: string | null
  contactName: string | null
  country: string | null
  verified: boolean
  onboardingCompletedAt: string | null
  walletProvider: string | null
  walletStatus: string | null
  createdAt: string
  updatedAt: string | null
}

export type AdminUsersSort = 'newest' | 'oldest' | 'recently_updated'

export type AdminUsersFilters = {
  search: string | null
  role: 'pyme' | 'investor' | 'supplier' | 'admin' | null
  verification: 'verified' | 'unverified' | null
  onboarding: 'completed' | 'incomplete' | 'legacy' | null
  wallet: 'connected' | 'none' | 'pollar' | 'stellar-wallets-kit' | null
  signupFrom: string | null
  signupTo: string | null
  sort: AdminUsersSort
  page: number
  pageSize: number
}

export type AdminUsersResult = {
  rows: AdminUserListItem[]
  total: number
  page: number
  pageSize: number
}

export type AdminUserCompany = {
  id: string
  companyName: string | null
  country: string | null
  verified: boolean
  createdAt: string
}

export type AdminUserDetail = {
  profile: AdminUserListItem & {
    phone: string | null
    sector: string | null
    website: string | null
    bio: string | null
    stellarPublicKey: string | null
  }
  companies: AdminUserCompany[]
  recentAuditEvents: AdminAuditEvent[]
  dealCounts: { asPyme: number; asInvestor: number }
}

/** Row from the append-only admin_audit_events table */
export type AdminAuditEvent = {
  id: string
  adminUserId: string
  adminName: string | null
  action: string
  entityType: string
  entityId: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  createdAt: string
}

export type AdminAuditFilters = {
  adminId: string | null
  action: string | null
  entityType: string | null
  entityIds: string[] | null
  from: string | null
  to: string | null
  page: number
  pageSize: number
}

export type AdminAuditResult = {
  rows: AdminAuditEvent[]
  total: number
  page: number
  pageSize: number
  admins: { id: string; name: string }[]
}
