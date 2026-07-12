'use client'

/**
 * Deploy and manage Trustless Work multi-release repayment escrows.
 * Admin deploys / updates / releases; PyME micro-funds.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  useInitializeEscrow,
  useSendTransaction,
  useFundEscrow,
  useApproveMilestone,
  useReleaseFunds,
  useUpdateEscrow,
  useGetEscrowsFromIndexerBySigner,
  useGetEscrowFromIndexerByContractIds,
  useGetMultipleEscrowBalances,
} from '@trustless-work/escrow/hooks'
import type {
  InitializeMultiReleaseEscrowPayload,
  FundEscrowPayload,
  MultiReleaseReleaseFundsPayload,
  UpdateMultiReleaseEscrowPayload,
  MultiReleaseMilestone,
  GetEscrowsFromIndexerResponse,
} from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { usePollarSession } from '@/providers/pollar-provider'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import {
  PLATFORM_FEE_PERCENT,
  DEFAULT_FIRST_MILESTONE_PERCENT,
  repaymentEscrowAmount,
  repaymentMilestoneAmount,
  repaymentRemainingAmount,
} from '@/lib/deals/fees'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import { createClient } from '@/lib/supabase/client'
import type { RepaymentMilestoneCache, RepaymentStatus } from '@/lib/types'

export function repaymentEngagementId(dealId: string): string {
  return `${dealId}:repayment`
}

function roundUsdc(n: number): number {
  return Math.round(n * 100) / 100
}

function isMilestoneReleased(m: MultiReleaseMilestone | undefined): boolean {
  if (!m) return false
  if (m.flags?.released === true) return true
  const s = (m.status ?? '').toLowerCase()
  return s === 'released' || s === 'completed'
}

export function cacheMilestonesFromIndexer(
  escrow: GetEscrowsFromIndexerResponse | null | undefined,
): RepaymentMilestoneCache[] {
  if (!escrow?.milestones?.length) return []
  return escrow.milestones.map((m, index) => {
    const multi = m as MultiReleaseMilestone
    return {
      index,
      description: multi.description ?? `Milestone ${index + 1}`,
      amount: Number(multi.amount ?? 0),
      released: isMilestoneReleased(multi),
    }
  })
}

export function deriveRepaymentStatusFromMilestones(
  milestones: RepaymentMilestoneCache[],
  balance: number,
  totalGrossed = 0,
): RepaymentStatus {
  if (milestones.length === 0) return 'escrow_initialized'
  const allReleased = milestones.every((m) => m.released)
  const scheduled = milestones.reduce((sum, m) => sum + m.amount, 0)
  const remaining =
    totalGrossed > 0 ? repaymentRemainingAmount(totalGrossed, milestones.map((m) => m.amount)) : 0

  if (allReleased) {
    // More repayment still to schedule via updateEscrow
    if (remaining > 0.01) return 'partially_released'
    return 'released'
  }

  const anyReleased = milestones.some((m) => m.released)
  const openAmount = milestones
    .filter((m) => !m.released)
    .reduce((sum, m) => sum + m.amount, 0)
  if (openAmount > 0 && balance + 1e-9 >= openAmount) {
    return 'ready_to_release'
  }
  if (balance > 0) return 'funding'
  return anyReleased || scheduled > 0 ? (anyReleased ? 'partially_released' : 'escrow_initialized') : 'escrow_initialized'
}

interface DeployRepaymentParams {
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

interface FundRepaymentParams {
  dealId: string
  contractId: string
  pymeAddress: string
  amount: number
  provider: string | null
}

interface ReleaseMilestoneParams {
  dealId: string
  contractId: string
  releaseSigner: string
  milestoneIndex: number
  provider: string | null
}

interface AddMilestoneParams {
  dealId: string
  contractId: string
  adminAddress: string
  investorAddress: string
  /** Amount for the new milestone; defaults to remaining grossed total. */
  amount?: number
  description?: string
  provider: string | null
}

export function useRepaymentEscrow() {
  const supabase = useMemo(() => createClient(), [])
  const { deployEscrow } = useInitializeEscrow()
  const { sendTransaction } = useSendTransaction()
  const { fundEscrow } = useFundEscrow()
  const { approveMilestone } = useApproveMilestone()
  const { releaseFunds } = useReleaseFunds()
  const { updateEscrow } = useUpdateEscrow()
  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
  const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
  const { getMultipleBalances } = useGetMultipleEscrowBalances()
  const pollar = usePollarSession()
  const [isWorking, setIsWorking] = useState(false)

  const signAndSend = useCallback(
    async (unsignedTransaction: string, address: string, provider: string | null) => {
      if (provider === 'pollar') {
        return pollar.signAndSubmitTx(unsignedTransaction)
      }
      const signedXdr = await signTransaction({ unsignedTransaction, address })
      if (!signedXdr) throw new Error('Failed to sign transaction')
      const txResult = await sendTransaction(signedXdr)
      if (txResult.status !== 'SUCCESS') {
        throw new Error(
          'message' in txResult
            ? (txResult as { message: string }).message
            : 'Transaction submission failed',
        )
      }
      return undefined
    },
    [pollar, sendTransaction],
  )

  const fetchIndexerEscrow = useCallback(
    async (contractId: string): Promise<GetEscrowsFromIndexerResponse | null> => {
      const escrows = await getEscrowByContractIds({ contractIds: [contractId] })
      return escrows?.[0] ?? null
    },
    [getEscrowByContractIds],
  )

  const syncDealFromIndexer = useCallback(
    async (
      dealId: string,
      contractId: string,
      extras?: Record<string, unknown>,
    ): Promise<{
      milestones: RepaymentMilestoneCache[]
      status: RepaymentStatus
      balance: number
    }> => {
      let escrow = await fetchIndexerEscrow(contractId)
      let balance = Number(escrow?.balance ?? 0)
      try {
        const balances = await getMultipleBalances({ addresses: [contractId] })
        const bal = balances?.[0]?.balance
        if (bal != null && Number.isFinite(Number(bal))) {
          balance = Number(bal)
        }
      } catch {
        // Indexer balance is fine as fallback
      }
      const milestones = cacheMilestonesFromIndexer(escrow)
      const { data: dealRow } = await supabase
        .from('deals')
        .select('repayment_total_amount')
        .eq('id', dealId)
        .single()
      const totalGrossed = Number(dealRow?.repayment_total_amount ?? 0)
      const status = deriveRepaymentStatusFromMilestones(
        milestones,
        balance,
        totalGrossed,
      )
      const { error } = await supabase
        .from('deals')
        .update({
          repayment_milestones: milestones,
          repayment_status: status,
          escrow_status:
            status === 'released'
              ? 'completed'
              : status === 'escrow_initialized'
                ? 'initialized'
                : 'active',
          ...(status === 'released'
            ? {
                status: 'completed',
                completed_at: new Date().toISOString(),
              }
            : {}),
          ...extras,
        })
        .eq('id', dealId)
      if (error) throw error
      return { milestones, status, balance }
    },
    [fetchIndexerEscrow, getMultipleBalances, supabase],
  )

  const deployRepaymentEscrow = useCallback(
    async (params: DeployRepaymentParams): Promise<{ contractId: string }> => {
      if (!MERCATO_PLATFORM_ADDRESS) {
        throw new Error('Platform address not configured')
      }
      if (!USDC_TRUSTLINE.address) {
        throw new Error('USDC trustline not configured')
      }
      if (!params.investorAddress?.trim()) {
        throw new Error('Investor wallet address is required')
      }

      setIsWorking(true)
      try {
        const { profit } = computeInvestorReturns(
          params.principal,
          params.aprPercent,
          params.termDays,
        )
        const totalGrossed = repaymentEscrowAmount(params.principal, profit)
        const firstPercent =
          params.firstMilestonePercent ?? DEFAULT_FIRST_MILESTONE_PERCENT
        const firstAmount = repaymentMilestoneAmount(totalGrossed, firstPercent)
        if (firstAmount <= 0) {
          throw new Error('First milestone amount must be positive')
        }

        const engagementId = repaymentEngagementId(params.dealId)
        const investor = params.investorAddress.trim()

        const payload: InitializeMultiReleaseEscrowPayload = {
          signer: params.adminAddress,
          engagementId,
          title: `Repayment · ${params.productName}`,
          description: `SMB multi-release repayment for deal ${params.dealId}`,
          roles: {
            approver: MERCATO_PLATFORM_ADDRESS,
            serviceProvider: investor,
            platformAddress: MERCATO_PLATFORM_ADDRESS,
            releaseSigner: MERCATO_PLATFORM_ADDRESS,
            disputeResolver: MERCATO_PLATFORM_ADDRESS,
          },
          platformFee: PLATFORM_FEE_PERCENT,
          trustline: {
            address: USDC_TRUSTLINE.address,
            symbol: USDC_TRUSTLINE.symbol,
          },
          milestones: [
            {
              description: `Repayment milestone 1 (${firstPercent}%)`,
              amount: firstAmount,
              receiver: investor,
            },
          ],
        }

        const deployResponse = await deployEscrow(payload, 'multi-release')
        if (deployResponse.status !== 'SUCCESS' || !deployResponse.unsignedTransaction) {
          throw new Error('Failed to create repayment escrow transaction')
        }

        let contractId: string | undefined

        if (params.provider === 'pollar') {
          await pollar.signAndSubmitTx(deployResponse.unsignedTransaction)
          for (let attempt = 0; attempt < 5; attempt++) {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 3000))
            try {
              const escrows = await getEscrowsBySigner({
                signer: params.adminAddress,
              })
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
          const escrowResponse = txResult as {
            contractId?: string
            escrow?: { contractId?: string }
          }
          contractId =
            escrowResponse.contractId ?? escrowResponse.escrow?.contractId
        }

        if (!contractId) {
          throw new Error('Repayment escrow contract ID was not confirmed')
        }

        const initialMilestones: RepaymentMilestoneCache[] = [
          {
            index: 0,
            description: `Repayment milestone 1 (${firstPercent}%)`,
            amount: firstAmount,
            released: false,
          },
        ]

        // Keep repayment_due_at from delivery confirmation; only backfill if missing
        const { data: existingDeal } = await supabase
          .from('deals')
          .select('repayment_due_at')
          .eq('id', params.dealId)
          .single()

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
          dueAt.setDate(dueAt.getDate() + Math.max(1, params.termDays))
          updates.repayment_due_at = dueAt.toISOString()
        }

        const { error } = await supabase
          .from('deals')
          .update(updates)
          .eq('id', params.dealId)

        if (error) throw error

        return { contractId }
      } finally {
        setIsWorking(false)
      }
    },
    [deployEscrow, getEscrowsBySigner, pollar, sendTransaction, supabase],
  )

  const fundRepaymentEscrow = useCallback(
    async (params: FundRepaymentParams) => {
      setIsWorking(true)
      try {
        const amount = roundUsdc(params.amount)
        if (amount <= 0) throw new Error('Fund amount must be positive')

        const payload: FundEscrowPayload = {
          contractId: params.contractId,
          signer: params.pymeAddress,
          amount,
        }
        const fundResponse = await fundEscrow(payload, 'multi-release')
        if (fundResponse.status !== 'SUCCESS' || !fundResponse.unsignedTransaction) {
          throw new Error('Failed to build repayment fund transaction')
        }
        await signAndSend(
          fundResponse.unsignedTransaction,
          params.pymeAddress,
          params.provider,
        )

        // Brief indexer lag allowance
        await new Promise((r) => setTimeout(r, 1500))
        await syncDealFromIndexer(params.dealId, params.contractId)
      } finally {
        setIsWorking(false)
      }
    },
    [fundEscrow, signAndSend, syncDealFromIndexer],
  )

  const approveAndReleaseMilestone = useCallback(
    async (params: ReleaseMilestoneParams) => {
      setIsWorking(true)
      try {
        const indexStr = String(params.milestoneIndex)
        const approveResponse = await approveMilestone(
          {
            contractId: params.contractId,
            milestoneIndex: indexStr,
            approver: params.releaseSigner,
          },
          'multi-release',
        )
        if (
          approveResponse.status !== 'SUCCESS' ||
          !approveResponse.unsignedTransaction
        ) {
          throw new Error('Failed to build approve transaction')
        }
        await signAndSend(
          approveResponse.unsignedTransaction,
          params.releaseSigner,
          params.provider,
        )

        const releasePayload: MultiReleaseReleaseFundsPayload = {
          contractId: params.contractId,
          releaseSigner: params.releaseSigner,
          milestoneIndex: indexStr,
        }
        const releaseResponse = await releaseFunds(releasePayload, 'multi-release')
        if (
          releaseResponse.status !== 'SUCCESS' ||
          !releaseResponse.unsignedTransaction
        ) {
          throw new Error('Failed to build release transaction')
        }
        await signAndSend(
          releaseResponse.unsignedTransaction,
          params.releaseSigner,
          params.provider,
        )

        await new Promise((r) => setTimeout(r, 1500))
        await syncDealFromIndexer(params.dealId, params.contractId)
      } finally {
        setIsWorking(false)
      }
    },
    [approveMilestone, releaseFunds, signAndSend, syncDealFromIndexer],
  )

  const addRepaymentMilestone = useCallback(
    async (params: AddMilestoneParams) => {
      if (!MERCATO_PLATFORM_ADDRESS) {
        throw new Error('Platform address not configured')
      }
      setIsWorking(true)
      try {
        const escrow = await fetchIndexerEscrow(params.contractId)
        if (!escrow) throw new Error('Escrow not found in indexer')

        const existing = cacheMilestonesFromIndexer(escrow)
        const { data: dealRow } = await supabase
          .from('deals')
          .select('repayment_total_amount')
          .eq('id', params.dealId)
          .single()

        const totalGrossed = Number(dealRow?.repayment_total_amount ?? 0)
        const scheduled = existing.map((m) => m.amount)
        const remaining = repaymentRemainingAmount(totalGrossed, scheduled)
        const amount = roundUsdc(params.amount ?? remaining)
        if (amount <= 0) {
          throw new Error('No remaining repayment amount to schedule')
        }
        if (totalGrossed > 0 && amount > remaining + 0.01) {
          throw new Error(
            `Milestone amount exceeds remaining (${remaining} USDC)`,
          )
        }

        const investor = params.investorAddress.trim()
        const nextIndex = existing.length
        const newMilestone = {
          description:
            params.description?.trim() ||
            `Repayment milestone ${nextIndex + 1}`,
          amount,
          receiver: investor,
        }

        const roles = escrow.roles as {
          approver: string
          serviceProvider: string
          platformAddress: string
          releaseSigner: string
          disputeResolver: string
        }

        const updatePayload: UpdateMultiReleaseEscrowPayload = {
          contractId: params.contractId,
          signer: params.adminAddress,
          escrow: {
            engagementId: escrow.engagementId,
            title: escrow.title,
            description: escrow.description,
            roles: {
              approver: roles.approver,
              serviceProvider: roles.serviceProvider,
              platformAddress: roles.platformAddress,
              releaseSigner: roles.releaseSigner,
              disputeResolver: roles.disputeResolver,
            },
            platformFee: escrow.platformFee,
            trustline: escrow.trustline,
            milestones: [
              ...escrow.milestones.map((m) => {
                const multi = m as MultiReleaseMilestone
                return {
                  description: multi.description,
                  amount: Number(multi.amount ?? 0),
                  receiver: multi.receiver || investor,
                  status: multi.status,
                  flags: multi.flags,
                }
              }),
              newMilestone,
            ],
            isActive: escrow.isActive ?? true,
          },
        }

        const updateResponse = await updateEscrow(updatePayload, 'multi-release')
        if (
          updateResponse.status !== 'SUCCESS' ||
          !updateResponse.unsignedTransaction
        ) {
          throw new Error('Failed to build update escrow transaction')
        }
        await signAndSend(
          updateResponse.unsignedTransaction,
          params.adminAddress,
          params.provider,
        )

        await new Promise((r) => setTimeout(r, 1500))
        await syncDealFromIndexer(params.dealId, params.contractId)
      } finally {
        setIsWorking(false)
      }
    },
    [fetchIndexerEscrow, signAndSend, supabase, syncDealFromIndexer, updateEscrow],
  )

  return {
    isWorking,
    deployRepaymentEscrow,
    fundRepaymentEscrow,
    approveAndReleaseMilestone,
    addRepaymentMilestone,
    syncDealFromIndexer,
    cacheMilestonesFromIndexer,
  }
}
