'use client'

/**
 * Wire Trustless Work hooks, wallet transport, and UI busy state into the
 * repayment command layer. Persistence, indexer retries, and payload
 * construction live in `lib/deals/`. Draft-based review (Fase 2-5) is handled
 * here when `params.draft` is provided, preserving stale guard and audit.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  useInitializeEscrow,
  useSendTransaction,
  useFundEscrow,
  useApproveMilestone,
  useReleaseFunds,
  useUpdateEscrow,
  useStartDispute,
  useResolveDispute,
  useGetEscrowsFromIndexerBySigner,
  useGetEscrowFromIndexerByContractIds,
  useGetMultipleEscrowBalances,
} from '@trustless-work/escrow/hooks'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { usePollarSession } from '@/providers/pollar-provider'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import {
  MERCATO_PLATFORM_ADDRESS,
  repaymentEscrowRoles,
} from '@/lib/trustless/config'
import { createClient } from '@/lib/supabase/client'
import { cacheMilestonesFromIndexer } from '@/lib/deals/repayment-escrow-helpers'
import { createRepaymentEscrowCommands } from '@/lib/deals/repayment-escrow-commands'
import { createSupabaseDealRepository } from '@/lib/deals/repayment-escrow-reconcile'
import type {
  AddMilestoneParams,
  DeployRepaymentParams,
  DisputeMilestoneParams,
  FundRepaymentParams,
  IndexerPort,
  ReleaseMilestoneParams,
  ResolveDisputeParams,
  SendTxResult,
  SyncDealFromIndexerOptions,
  TxTransport,
} from '@/lib/deals/repayment-escrow-types'
import {
  DEFAULT_REPAYMENT_RETRY_POLICY,
  defaultWait,
} from '@/lib/deals/repayment-retry'
import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'
import { revalidateAuthoritativeState, type StaleFieldDiff } from '@/lib/trustless/repayment-deployment-guard'
import { recordRepaymentEscrowAction } from '@/lib/trustless/repayment-action-audit'
import { compareRepaymentEscrowDrafts, toTrustlessWorkDeploymentPayload } from '@/lib/trustless/repayment-deployment-draft'
import {
  validateRepaymentEscrowDraft,
  validateRepaymentRoleOverrides,
} from '@/lib/trustless/repayment-deployment-validation'
import { buildRepaymentConfigSnapshot } from '@/lib/trustless/repayment-config-snapshot'
import type { RepaymentMilestoneCache } from '@/lib/types'

export function useRepaymentEscrow() {
  const supabase = useMemo(() => createClient(), [])
  const { deployEscrow } = useInitializeEscrow()
  const { sendTransaction } = useSendTransaction()
  const { fundEscrow } = useFundEscrow()
  const { approveMilestone } = useApproveMilestone()
  const { releaseFunds } = useReleaseFunds()
  const { updateEscrow } = useUpdateEscrow()
  const { startDispute } = useStartDispute()
  const { resolveDispute } = useResolveDispute()
  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const { getMultipleBalances } = useGetMultipleEscrowBalances()
  const pollar = usePollarSession()
  const [isWorking, setIsWorking] = useState(false)
  const deployLockRef = useRef(false)

  const getAuditUserId = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getUser()
      return data.user?.id ?? null
    } catch {
      return null
    }
  }, [supabase])
  const safeAudit = useCallback(async (input: Parameters<typeof recordRepaymentEscrowAction>[0]): Promise<void> => {
    try {
      await recordRepaymentEscrowAction(input)
    } catch {
      // best-effort
    }
  }, [])

  const transport: TxTransport = useMemo(
    () => ({
      async signAndSend(unsignedTransaction, address, provider) {
        if (provider === 'pollar') {
          await pollar.signAndSubmitTx(unsignedTransaction)
          return undefined
        }
        const signedXdr = await signTransaction({
          unsignedTransaction,
          address,
        })
        if (!signedXdr) throw new Error('Failed to sign transaction')
        const txResult = await sendTransaction(signedXdr)
        if (txResult.status !== 'SUCCESS') {
          throw new Error(
            'message' in txResult
              ? (txResult as { message: string }).message
              : 'Transaction submission failed',
          )
        }
        return txResult as SendTxResult
      },
    }),
    [pollar, sendTransaction],
  )

  const indexer: IndexerPort = useMemo(
    () => ({
      async getByContractId(contractId) {
        const escrows = await getEscrowByContractIds({
          contractIds: [contractId],
        })
        return escrows?.[0] ?? null
      },
      getBySigner(signer) {
        return getEscrowsBySigner({ signer })
      },
      async getBalance(contractId) {
        try {
          const balances = await getMultipleBalances({
            addresses: [contractId],
          })
          const bal = balances?.[0]?.balance
          if (bal != null && Number.isFinite(Number(bal))) {
            return Number(bal)
          }
        } catch {
          // Indexer balance is fine as fallback
        }
        return null
      },
    }),
    [getEscrowByContractIds, getEscrowsBySigner, getMultipleBalances],
  )

  const deals = useMemo(
    () => createSupabaseDealRepository(supabase),
    [supabase],
  )

  const commands = useMemo(
    () =>
      createRepaymentEscrowCommands({
        builder: {
          initialize: deployEscrow,
          fund: fundEscrow,
          approveMilestone,
          releaseFunds,
          updateEscrow,
          startDispute,
          resolveDispute,
        },
        transport,
        indexer,
        deals,
        config: {
          platformAddress: MERCATO_PLATFORM_ADDRESS,
          trustline: {
            address: USDC_TRUSTLINE.address,
            symbol: USDC_TRUSTLINE.symbol,
          },
          roles: repaymentEscrowRoles,
        },
        wait: defaultWait,
        retry: DEFAULT_REPAYMENT_RETRY_POLICY,
      }),
    [
      approveMilestone,
      deals,
      deployEscrow,
      fundEscrow,
      indexer,
      releaseFunds,
      resolveDispute,
      startDispute,
      transport,
      updateEscrow,
    ],
  )

  const run = useCallback(async <T>(op: () => Promise<T>) => {
    setIsWorking(true)
    try {
      return await op()
    } finally {
      setIsWorking(false)
    }
  }, [])

  const deployRepaymentEscrow = useCallback(
    async (params: DeployRepaymentParams): Promise<{ contractId: string }> => {
      if (deployLockRef.current) throw new Error('Deployment already in progress')
      deployLockRef.current = true
      setIsWorking(true)
      try {
        if (params.draft) {
          let succeededContractId: string | null = null
          let adminUserIdForDeploy: string | null = null
          let changedFieldsForDeploy: readonly string[] = []
          let submissionTimestampForDeploy = ''
          try {
            if (!params.dealId.trim()) throw new Error('Deal is required')
            if (!isLikelyStellarAddress(params.adminAddress)) {
              throw new Error('Admin wallet address is not a valid Stellar address')
            }
            if (params.adminAddress !== params.draft.signer) {
              throw new Error('Connected wallet changed during review — regenerate the draft')
            }
            const finalValidation = validateRepaymentEscrowDraft(params.draft)
            if (!finalValidation.ok) {
              throw new Error(finalValidation.errors.map((e) => e.message).join(' | '))
            }
            const roleValidation = validateRepaymentRoleOverrides(
              {
                approver: params.draft.roles.approver,
                serviceProvider: params.draft.roles.serviceProvider,
                disputeResolver: params.draft.roles.disputeResolver,
              },
              params.audit?.generatedDraft ?? params.draft,
            )
            if (!roleValidation.ok) {
              const err = new Error(
                roleValidation.errors.map((e) => e.message).join(' | '),
              ) as Error & { code?: string }
              err.code = roleValidation.errors[0]?.code
              throw err
            }
            if (!MERCATO_PLATFORM_ADDRESS) throw new Error('Platform address not configured')
            if (!USDC_TRUSTLINE.address) throw new Error('USDC trustline not configured')

            const revalidation = await revalidateAuthoritativeState(
              params.draft,
              params.dealId,
              buildRepaymentConfigSnapshot(),
            )
            if (revalidation.status === 'stale') {
              const err = new Error(
                `Stale authoritative data: ${revalidation.changedFields.map((f) => `${f.field} ${f.reviewed}→${f.authoritative}`).join(' | ')}`,
              ) as Error & { changedFields?: readonly StaleFieldDiff[]; code?: string }
              err.changedFields = revalidation.changedFields
              err.code = 'STALE_DEPLOYMENT'
              await safeAudit({
                dealId: params.dealId,
                actionType: 'deployment_failed',
                adminUserId: await getAuditUserId(),
                signingWallet: params.adminAddress,
                contractId: null,
                generatedPayload: params.audit?.generatedDraft ?? null,
                reviewedPayload: params.draft,
                changedFields: params.audit?.generatedDraft ? compareRepaymentEscrowDrafts(params.audit.generatedDraft, params.draft).map((c) => c.path) : [],
                reviewTimestamp: params.audit?.reviewTimestamp ?? null,
                submissionTimestamp: new Date().toISOString(),
                completionTimestamp: new Date().toISOString(),
                transactionHash: null,
                failureMessage: err.message,
              })
              throw err
            }

            adminUserIdForDeploy = await getAuditUserId()
            changedFieldsForDeploy = params.audit?.generatedDraft ? compareRepaymentEscrowDrafts(params.audit.generatedDraft, params.draft).map((c) => c.path) : []
            submissionTimestampForDeploy = new Date().toISOString()
            await safeAudit({
              dealId: params.dealId,
              actionType: 'deployment_submitted',
              adminUserId: adminUserIdForDeploy,
              signingWallet: params.adminAddress,
              contractId: null,
              generatedPayload: params.audit?.generatedDraft ?? null,
              reviewedPayload: params.draft,
              changedFields: changedFieldsForDeploy,
              reviewTimestamp: params.audit?.reviewTimestamp ?? null,
              submissionTimestamp: submissionTimestampForDeploy,
              completionTimestamp: null,
              transactionHash: null,
              failureMessage: null,
            })

            const payload = toTrustlessWorkDeploymentPayload(params.draft)
            const engagementId = payload.engagementId
            const totalGrossed = params.draft.repayment.totalGrossed
            const firstMilestone = params.draft.milestones[0]
            if (!firstMilestone) throw new Error('Reviewed draft has no initial milestone')
            const deployResponse = await deployEscrow(payload, 'multi-release')
            if (deployResponse.status !== 'SUCCESS' || !deployResponse.unsignedTransaction) {
              throw new Error('Failed to create repayment escrow transaction')
            }
            let contractId: string | undefined
            let txHash: string | null = null
            if (params.provider === 'pollar') {
              await pollar.signAndSubmitTx(deployResponse.unsignedTransaction)
              for (let attempt = 0; attempt < 5; attempt++) {
                if (attempt > 0) await new Promise((r) => setTimeout(r, 3000))
                try {
                  const escrows = await getEscrowsBySigner({ signer: params.adminAddress })
                  const match = escrows.find((e) => e.engagementId === engagementId)
                  if (match?.contractId) {
                    contractId = match.contractId
                    break
                  }
                } catch {
                  // Indexer lag — retry
                }
              }
            } else {
              const signedXdr = await signTransaction({
                unsignedTransaction: deployResponse.unsignedTransaction,
                address: params.adminAddress,
              })
              if (!signedXdr) throw new Error('Failed to sign transaction')
              const txResult = await sendTransaction(signedXdr)
              if (txResult.status !== 'SUCCESS') {
                throw new Error(
                  'message' in txResult
                    ? (txResult as { message: string }).message
                    : 'Transaction submission failed',
                )
              }
              const escrowResponse = txResult as SendTxResult & { hash?: string; transactionHash?: string }
              contractId = escrowResponse.contractId ?? escrowResponse.escrow?.contractId
              txHash = (escrowResponse as unknown as { hash?: string }).hash ?? (escrowResponse as unknown as { transactionHash?: string }).transactionHash ?? null
            }
            if (!contractId) throw new Error('Repayment escrow contract ID was not confirmed')
            succeededContractId = contractId
            const { data: existingDeal } = await supabase
              .from('deals')
              .select('repayment_due_at, escrow_contract_address')
              .eq('id', params.dealId)
              .single()
            if (existingDeal?.escrow_contract_address) {
              throw new Error('Duplicate deployment detected — escrow already assigned')
            }
            const initialMilestones: RepaymentMilestoneCache[] = [
              { index: 0, description: firstMilestone.description, amount: firstMilestone.amount, released: false },
            ]
            const updates: Record<string, unknown> = {
              escrow_id: engagementId,
              escrow_contract_address: contractId,
              escrow_status: 'initialized',
              repayment_status: 'escrow_initialized',
              repayment_total_amount: totalGrossed,
              repayment_milestones: initialMilestones,
            }
            if (!existingDeal?.repayment_due_at) {
              const dueAt = new Date()
              dueAt.setDate(dueAt.getDate() + Math.max(1, params.termDays ?? 30))
              updates.repayment_due_at = dueAt.toISOString()
            }
            const { data: updated, error } = await supabase
              .from('deals')
              .update(updates)
              .eq('id', params.dealId)
              .is('escrow_contract_address', null)
              .select('id')
            if (error) throw error
            if (!updated || updated.length === 0) {
              throw new Error('Duplicate deployment detected — escrow already assigned by concurrent process')
            }
            await safeAudit({
              dealId: params.dealId,
              actionType: 'deployment_succeeded',
              adminUserId: adminUserIdForDeploy,
              signingWallet: params.adminAddress,
              contractId,
              generatedPayload: params.audit?.generatedDraft ?? null,
              reviewedPayload: params.draft,
              changedFields: changedFieldsForDeploy,
              reviewTimestamp: params.audit?.reviewTimestamp ?? null,
              submissionTimestamp: submissionTimestampForDeploy,
              completionTimestamp: new Date().toISOString(),
              transactionHash: txHash,
              failureMessage: null,
            })
            return { contractId }
          } catch (error) {
            const failureMessage = error instanceof Error ? error.message : 'Deployment failed'
            const isStale = (error as Error & { code?: string }).code === 'STALE_DEPLOYMENT'
            if (!isStale) {
              await safeAudit({
                dealId: params.dealId,
                actionType: 'deployment_failed',
                adminUserId: adminUserIdForDeploy ?? (await getAuditUserId()),
                signingWallet: params.adminAddress,
                contractId: succeededContractId,
                generatedPayload: params.audit?.generatedDraft ?? null,
                reviewedPayload: params.draft,
                changedFields: changedFieldsForDeploy ?? [],
                reviewTimestamp: params.audit?.reviewTimestamp ?? null,
                submissionTimestamp: submissionTimestampForDeploy ?? new Date().toISOString(),
                completionTimestamp: new Date().toISOString(),
                transactionHash: null,
                failureMessage,
              })
            }
            throw error
          }
        }
        throw new Error(
          'Repayment escrow deployment requires a reviewed draft — direct params deployment is disabled for admin review compliance (#163)',
        )
      } finally {
        deployLockRef.current = false
        setIsWorking(false)
      }
    },
    [commands, deployEscrow, getAuditUserId, getEscrowsBySigner, pollar, safeAudit, sendTransaction, supabase],
  )
  const fundRepaymentEscrow = useCallback(
    (params: FundRepaymentParams) =>
      run(() => commands.fundRepaymentEscrow(params)),
    [commands, run],
  )
  const approveRepaymentMilestone = useCallback(
    async (params: ReleaseMilestoneParams) => {
      const auditBase = {
        dealId: params.dealId,
        contractId: params.contractId,
        signingWallet: params.releaseSigner,
        reviewedPayload: { milestoneIndex: params.milestoneIndex, contractId: params.contractId } as unknown,
      }
      try {
        const res = await run(() => commands.approveRepaymentMilestone(params))
        await safeAudit({
          dealId: auditBase.dealId,
          actionType: 'milestone_approved',
          adminUserId: await getAuditUserId(),
          signingWallet: auditBase.signingWallet,
          contractId: auditBase.contractId,
          generatedPayload: null,
          reviewedPayload: auditBase.reviewedPayload,
          changedFields: [],
          reviewTimestamp: null,
          submissionTimestamp: new Date().toISOString(),
          completionTimestamp: new Date().toISOString(),
          transactionHash: null,
          failureMessage: null,
        })
        return res
      } catch (error) {
        await safeAudit({
          dealId: auditBase.dealId,
          actionType: 'milestone_approval_failed',
          adminUserId: await getAuditUserId(),
          signingWallet: auditBase.signingWallet,
          contractId: auditBase.contractId,
          generatedPayload: null,
          reviewedPayload: auditBase.reviewedPayload,
          changedFields: [],
          reviewTimestamp: null,
          submissionTimestamp: new Date().toISOString(),
          completionTimestamp: new Date().toISOString(),
          transactionHash: null,
          failureMessage: error instanceof Error ? error.message : 'Approve failed',
        })
        throw error
      }
    },
    [commands, getAuditUserId, run, safeAudit],
  )
  const releaseRepaymentMilestone = useCallback(
    async (params: ReleaseMilestoneParams) => {
      const auditBase = {
        dealId: params.dealId,
        contractId: params.contractId,
        signingWallet: params.releaseSigner,
        reviewedPayload: { milestoneIndex: params.milestoneIndex, contractId: params.contractId } as unknown,
      }
      try {
        const res = await run(() => commands.releaseRepaymentMilestone(params))
        await safeAudit({
          dealId: auditBase.dealId,
          actionType: 'milestone_released',
          adminUserId: await getAuditUserId(),
          signingWallet: auditBase.signingWallet,
          contractId: auditBase.contractId,
          generatedPayload: null,
          reviewedPayload: auditBase.reviewedPayload,
          changedFields: [],
          reviewTimestamp: null,
          submissionTimestamp: new Date().toISOString(),
          completionTimestamp: new Date().toISOString(),
          transactionHash: null,
          failureMessage: null,
        })
        return res
      } catch (error) {
        await safeAudit({
          dealId: auditBase.dealId,
          actionType: 'milestone_release_failed',
          adminUserId: await getAuditUserId(),
          signingWallet: auditBase.signingWallet,
          contractId: auditBase.contractId,
          generatedPayload: null,
          reviewedPayload: auditBase.reviewedPayload,
          changedFields: [],
          reviewTimestamp: null,
          submissionTimestamp: new Date().toISOString(),
          completionTimestamp: new Date().toISOString(),
          transactionHash: null,
          failureMessage: error instanceof Error ? error.message : 'Release failed',
        })
        throw error
      }
    },
    [commands, getAuditUserId, run, safeAudit],
  )
  const approveAndReleaseMilestone = useCallback(
    (params: ReleaseMilestoneParams) =>
      run(() => commands.approveAndReleaseMilestone(params)),
    [commands, run],
  )
  const addRepaymentMilestone = useCallback(
    async (params: AddMilestoneParams) => {
      const auditBase = {
        dealId: params.dealId,
        contractId: params.contractId,
        signingWallet: params.adminAddress,
        reviewedPayload: { amount: params.amount, description: params.description, investorAddress: params.investorAddress } as unknown,
      }
      const changedFieldsForAdd = [
        params.description ? 'newMilestone.description' : null,
        params.amount != null ? 'newMilestone.amount' : null,
        params.investorAddress ? 'newMilestone.receiver' : null,
      ].filter(Boolean) as string[]
      let generatedForAdd: unknown = null
      try {
        const escrow = await indexer.getByContractId(params.contractId)
        if (escrow) {
          generatedForAdd = { existingMilestones: escrow.milestones ?? [], contractId: params.contractId }
        }
      } catch {
        // best-effort
      }
      try {
        await safeAudit({
          dealId: auditBase.dealId,
          actionType: 'milestone_update_submitted',
          adminUserId: await getAuditUserId(),
          signingWallet: auditBase.signingWallet,
          contractId: auditBase.contractId,
          generatedPayload: generatedForAdd,
          reviewedPayload: auditBase.reviewedPayload,
          changedFields: changedFieldsForAdd,
          reviewTimestamp: null,
          submissionTimestamp: new Date().toISOString(),
          completionTimestamp: null,
          transactionHash: null,
          failureMessage: null,
        })
        const res = await run(() => commands.addRepaymentMilestone(params))
        await safeAudit({
          dealId: auditBase.dealId,
          actionType: 'milestone_update_succeeded',
          adminUserId: await getAuditUserId(),
          signingWallet: auditBase.signingWallet,
          contractId: auditBase.contractId,
          generatedPayload: generatedForAdd,
          reviewedPayload: auditBase.reviewedPayload,
          changedFields: changedFieldsForAdd,
          reviewTimestamp: null,
          submissionTimestamp: new Date().toISOString(),
          completionTimestamp: new Date().toISOString(),
          transactionHash: null,
          failureMessage: null,
        })
        return res
      } catch (error) {
        await safeAudit({
          dealId: auditBase.dealId,
          actionType: 'milestone_update_failed',
          adminUserId: await getAuditUserId(),
          signingWallet: auditBase.signingWallet,
          contractId: auditBase.contractId,
          generatedPayload: generatedForAdd,
          reviewedPayload: auditBase.reviewedPayload,
          changedFields: changedFieldsForAdd,
          reviewTimestamp: null,
          submissionTimestamp: new Date().toISOString(),
          completionTimestamp: new Date().toISOString(),
          transactionHash: null,
          failureMessage: error instanceof Error ? error.message : 'Update failed',
        })
        throw error
      }
    },
    [commands, getAuditUserId, indexer, run, safeAudit],
  )
  const startRepaymentDispute = useCallback(
    (params: DisputeMilestoneParams) =>
      run(() => commands.startRepaymentDispute(params)),
    [commands, run],
  )
  const resolveRepaymentDispute = useCallback(
    (params: ResolveDisputeParams) =>
      run(() => commands.resolveRepaymentDispute(params)),
    [commands, run],
  )
  const syncDealFromIndexer = useCallback(
    (
      dealId: string,
      contractId: string,
      extras?: Record<string, unknown>,
      options?: SyncDealFromIndexerOptions,
    ) => commands.syncDealFromIndexer(dealId, contractId, extras, options),
    [commands],
  )

  return {
    isWorking,
    deployRepaymentEscrow,
    fundRepaymentEscrow,
    approveRepaymentMilestone,
    releaseRepaymentMilestone,
    approveAndReleaseMilestone,
    addRepaymentMilestone,
    startRepaymentDispute,
    resolveRepaymentDispute,
    syncDealFromIndexer,
    cacheMilestonesFromIndexer,
  }
}
