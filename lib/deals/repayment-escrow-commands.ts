import { syncDealFromIndexer } from '@/lib/deals/repayment-escrow-reconcile'
import {
  buildApprovePayload,
  buildFundPayload,
  buildReleasePayload,
  buildResolveDisputePayload,
  buildStartDisputePayload,
  contractIdFromSendResult,
  planAddMilestone,
  planRepaymentDeploy,
  repaymentDueAtIso,
  requireUnsigned,
  sendFailureMessage,
} from '@/lib/deals/repayment-escrow-payloads'
import type {
  AddMilestoneParams,
  DealRepository,
  DeployRepaymentParams,
  DisputeMilestoneParams,
  EscrowBuilder,
  FundRepaymentParams,
  IndexerPort,
  ReleaseMilestoneParams,
  RepaymentEscrowConfig,
  ResolveDisputeParams,
  SyncDealFromIndexerOptions,
  TxTransport,
} from '@/lib/deals/repayment-escrow-types'
import {
  DEFAULT_REPAYMENT_RETRY_POLICY,
  type RetryPolicy,
  type WaitFn,
} from '@/lib/deals/repayment-retry'

export type RepaymentEscrowCommandDeps = {
  builder: EscrowBuilder
  transport: TxTransport
  indexer: IndexerPort
  deals: DealRepository
  config: RepaymentEscrowConfig
  wait: WaitFn
  retry?: RetryPolicy
  now?: () => Date
}

export function createRepaymentEscrowCommands(deps: RepaymentEscrowCommandDeps) {
  const policy = deps.retry ?? DEFAULT_REPAYMENT_RETRY_POLICY
  const now = deps.now ?? (() => new Date())

  const sync = (
    dealId: string,
    contractId: string,
    extras?: Record<string, unknown>,
    options?: SyncDealFromIndexerOptions,
  ) =>
    syncDealFromIndexer(
      deps.indexer,
      deps.deals,
      deps.wait,
      policy,
      dealId,
      contractId,
      extras,
      options,
    )

  async function afterCommand(
    delayMs: number,
    dealId: string,
    contractId: string,
  ) {
    if (delayMs > 0) await deps.wait(delayMs)
    await sync(dealId, contractId)
  }

  async function deployRepaymentEscrow(
    params: DeployRepaymentParams,
  ): Promise<{ contractId: string }> {
    if (!deps.config.platformAddress) {
      throw new Error('Platform address not configured')
    }
    if (!deps.config.trustline.address) {
      throw new Error('USDC trustline not configured')
    }

    const investor =
      params.investorAddress?.trim() ||
      (await deps.deals.resolveInvestorWallet(params.dealId))
    if (!investor) {
      throw new Error('Investor wallet address is required')
    }

    const planned = planRepaymentDeploy({
      params,
      investorAddress: investor,
      roles: deps.config.roles(),
      trustline: deps.config.trustline,
    })

    const deployResponse = await deps.builder.initialize(
      planned.payload,
      'multi-release',
    )
    const unsigned = requireUnsigned(
      deployResponse,
      'Failed to create repayment escrow transaction',
    )

    let contractId: string | undefined

    if (params.provider === 'pollar') {
      await deps.transport.signAndSend(
        unsigned,
        params.adminAddress,
        params.provider,
      )
      const { attempts, delayMs } = policy.pollarContractLookup
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await deps.wait(delayMs)
        try {
          const escrows = await deps.indexer.getBySigner(params.adminAddress)
          const match = escrows.find(
            (e) => e.engagementId === planned.engagementId,
          )
          if (match?.contractId) {
            contractId = match.contractId
            break
          }
        } catch {
          // Indexer lag — retry
        }
      }
    } else {
      const txResult = await deps.transport.signAndSend(
        unsigned,
        params.adminAddress,
        params.provider,
      )
      if (txResult && txResult.status !== 'SUCCESS') {
        throw new Error(sendFailureMessage(txResult))
      }
      contractId = contractIdFromSendResult(txResult)
    }

    if (!contractId) {
      throw new Error('Repayment escrow contract ID was not confirmed')
    }

    const existingDueAt = await deps.deals.getRepaymentDueAt(params.dealId)
    const updates: Record<string, unknown> = {
      escrow_id: planned.engagementId,
      escrow_contract_address: contractId,
      escrow_status: 'initialized',
      repayment_status: 'escrow_initialized',
      repayment_total_amount: planned.totalGrossed,
      repayment_milestones: planned.initialMilestones,
    }
    if (!existingDueAt) {
      updates.repayment_due_at = repaymentDueAtIso(params.termDays, now())
    }
    await deps.deals.updateDeal(params.dealId, updates)

    return { contractId }
  }

  async function fundRepaymentEscrow(params: FundRepaymentParams) {
    const payload = buildFundPayload(params)
    const fundResponse = await deps.builder.fund(payload, 'multi-release')
    const unsigned = requireUnsigned(
      fundResponse,
      'Failed to build repayment fund transaction',
    )
    await deps.transport.signAndSend(
      unsigned,
      params.pymeAddress,
      params.provider,
    )
    await afterCommand(policy.afterCommandMs.fund, params.dealId, params.contractId)
  }

  async function approveRepaymentMilestone(params: ReleaseMilestoneParams) {
    const approveResponse = await deps.builder.approveMilestone(
      buildApprovePayload(params),
      'multi-release',
    )
    const unsigned = requireUnsigned(
      approveResponse,
      'Failed to build approve transaction',
    )
    await deps.transport.signAndSend(
      unsigned,
      params.releaseSigner,
      params.provider,
    )
    await afterCommand(
      policy.afterCommandMs.approve,
      params.dealId,
      params.contractId,
    )
  }

  async function releaseRepaymentMilestone(params: ReleaseMilestoneParams) {
    const releaseResponse = await deps.builder.releaseFunds(
      buildReleasePayload(params),
      'multi-release',
    )
    const unsigned = requireUnsigned(
      releaseResponse,
      'Failed to build release transaction',
    )
    await deps.transport.signAndSend(
      unsigned,
      params.releaseSigner,
      params.provider,
    )
    await afterCommand(
      policy.afterCommandMs.release,
      params.dealId,
      params.contractId,
    )
  }

  async function approveAndReleaseMilestone(params: ReleaseMilestoneParams) {
    const approvePayload = buildApprovePayload(params)
    const approveResponse = await deps.builder.approveMilestone(
      approvePayload,
      'multi-release',
    )
    const approveUnsigned = requireUnsigned(
      approveResponse,
      'Failed to build approve transaction',
    )
    await deps.transport.signAndSend(
      approveUnsigned,
      params.releaseSigner,
      params.provider,
    )

    const releaseResponse = await deps.builder.releaseFunds(
      buildReleasePayload(params),
      'multi-release',
    )
    const releaseUnsigned = requireUnsigned(
      releaseResponse,
      'Failed to build release transaction',
    )
    await deps.transport.signAndSend(
      releaseUnsigned,
      params.releaseSigner,
      params.provider,
    )

    await afterCommand(
      policy.afterCommandMs.approveAndRelease,
      params.dealId,
      params.contractId,
    )
  }

  async function addRepaymentMilestone(params: AddMilestoneParams) {
    if (!deps.config.platformAddress) {
      throw new Error('Platform address not configured')
    }
    const escrow = await deps.indexer.getByContractId(params.contractId)
    if (!escrow) throw new Error('Escrow not found in indexer')

    const totalGrossed = await deps.deals.getRepaymentTotal(params.dealId)
    const investor =
      params.investorAddress?.trim() ||
      (await deps.deals.resolveInvestorWallet(params.dealId))
    if (!investor) {
      throw new Error('Investor wallet address is required')
    }

    const { updatePayload } = planAddMilestone({
      params,
      escrow,
      totalGrossed,
      investorAddress: investor,
      roles: deps.config.roles(),
    })

    const updateResponse = await deps.builder.updateEscrow(
      updatePayload,
      'multi-release',
    )
    const unsigned = requireUnsigned(
      updateResponse,
      'Failed to build update escrow transaction',
    )
    await deps.transport.signAndSend(
      unsigned,
      params.adminAddress,
      params.provider,
    )
    await afterCommand(
      policy.afterCommandMs.addMilestone,
      params.dealId,
      params.contractId,
    )
  }

  async function startRepaymentDispute(params: DisputeMilestoneParams) {
    const response = await deps.builder.startDispute(
      buildStartDisputePayload(params),
      'multi-release',
    )
    const unsigned = requireUnsigned(
      response,
      'Failed to build start-dispute transaction',
    )
    await deps.transport.signAndSend(unsigned, params.signer, params.provider)
    await afterCommand(
      policy.afterCommandMs.dispute,
      params.dealId,
      params.contractId,
    )
  }

  async function resolveRepaymentDispute(params: ResolveDisputeParams) {
    const response = await deps.builder.resolveDispute(
      buildResolveDisputePayload(params),
      'multi-release',
    )
    const unsigned = requireUnsigned(
      response,
      'Failed to build resolve-dispute transaction',
    )
    await deps.transport.signAndSend(
      unsigned,
      params.disputeResolver,
      params.provider,
    )
    await afterCommand(
      policy.afterCommandMs.resolveDispute,
      params.dealId,
      params.contractId,
    )
  }

  return {
    deployRepaymentEscrow,
    fundRepaymentEscrow,
    approveRepaymentMilestone,
    releaseRepaymentMilestone,
    approveAndReleaseMilestone,
    addRepaymentMilestone,
    startRepaymentDispute,
    resolveRepaymentDispute,
    syncDealFromIndexer: sync,
  }
}
