import type {
  FundEscrowPayload,
  GetEscrowsFromIndexerResponse,
  InitializeMultiReleaseEscrowPayload,
  MultiReleaseReleaseFundsPayload,
  MultiReleaseResolveDisputePayload,
  MultiReleaseStartDisputePayload,
  UpdateMultiReleaseEscrowPayload,
} from '@trustless-work/escrow'
import type { RepaymentMilestoneCache, RepaymentStatus } from '@/lib/types'

export interface DeployRepaymentParams {
  dealId: string
  /** Platform / admin wallet that signs deploy. */
  adminAddress: string
  /** Optional — resolved from the deal's investor profile when omitted. */
  investorAddress?: string
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
  /** Optional — resolved from the deal's investor profile when omitted. */
  investorAddress?: string
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

export type RepaymentEscrowRoles = {
  approver: string
  serviceProvider: string
  platformAddress: string
  releaseSigner: string
  disputeResolver: string
}

export type EscrowBuildResult = {
  status: string
  unsignedTransaction?: string
}

export type SendTxResult = {
  status: string
  message?: string
  contractId?: string
  escrow?: { contractId?: string }
}

export type EscrowTrustline = {
  address: string
  symbol: string
}

export interface RepaymentEscrowConfig {
  platformAddress: string
  trustline: EscrowTrustline
  roles: () => RepaymentEscrowRoles
}

export interface EscrowBuilder {
  initialize(
    payload: InitializeMultiReleaseEscrowPayload,
    type: 'multi-release',
  ): Promise<EscrowBuildResult>
  fund(
    payload: FundEscrowPayload,
    type: 'multi-release',
  ): Promise<EscrowBuildResult>
  approveMilestone(
    payload: {
      contractId: string
      milestoneIndex: string
      approver: string
    },
    type: 'multi-release',
  ): Promise<EscrowBuildResult>
  releaseFunds(
    payload: MultiReleaseReleaseFundsPayload,
    type: 'multi-release',
  ): Promise<EscrowBuildResult>
  updateEscrow(
    payload: UpdateMultiReleaseEscrowPayload,
    type: 'multi-release',
  ): Promise<EscrowBuildResult>
  startDispute(
    payload: MultiReleaseStartDisputePayload,
    type: 'multi-release',
  ): Promise<EscrowBuildResult>
  resolveDispute(
    payload: MultiReleaseResolveDisputePayload,
    type: 'multi-release',
  ): Promise<EscrowBuildResult>
}

export interface TxTransport {
  signAndSend(
    unsignedTransaction: string,
    address: string,
    provider: string | null,
  ): Promise<SendTxResult | undefined>
}

export interface IndexerPort {
  getByContractId(
    contractId: string,
  ): Promise<GetEscrowsFromIndexerResponse | null>
  getBySigner(signer: string): Promise<GetEscrowsFromIndexerResponse[]>
  getBalance(contractId: string): Promise<number | null>
}

export interface DealRepository {
  getRepaymentDueAt(dealId: string): Promise<string | null>
  getRepaymentTotal(dealId: string): Promise<number>
  updateDeal(dealId: string, patch: Record<string, unknown>): Promise<void>
  resolveInvestorWallet(dealId: string): Promise<string | null>
}

export type SyncDealFromIndexerResult = {
  milestones: RepaymentMilestoneCache[]
  status: RepaymentStatus
  balance: number
}

export type SyncDealFromIndexerOptions = {
  retryOnEmptyMilestones?: boolean
}
