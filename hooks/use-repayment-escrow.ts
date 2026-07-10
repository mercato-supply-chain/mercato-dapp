'use client'

/**
 * Deploy and manage Trustless Work single-release repayment escrows.
 * Reuses TW hooks + wallet signing from the former supplier-escrow flow.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  useInitializeEscrow,
  useSendTransaction,
  useFundEscrow,
  useApproveMilestone,
  useReleaseFunds,
  useGetEscrowsFromIndexerBySigner,
} from '@trustless-work/escrow/hooks'
import type {
  InitializeSingleReleaseEscrowPayload,
  FundEscrowPayload,
} from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { usePollarSession } from '@/providers/pollar-provider'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { PLATFORM_FEE_PERCENT, repaymentEscrowAmount } from '@/lib/deals/fees'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import { createClient } from '@/lib/supabase/client'

export function repaymentEngagementId(dealId: string): string {
  return `${dealId}:repayment`
}

interface DeployRepaymentParams {
  dealId: string
  pymeAddress: string
  investorAddress: string
  principal: number
  aprPercent: number
  termDays: number
  productName: string
  provider: string | null
}

interface FundRepaymentParams {
  contractId: string
  pymeAddress: string
  amount: number
  provider: string | null
}

interface ReleaseRepaymentParams {
  contractId: string
  releaseSigner: string
  provider: string | null
}

export function useRepaymentEscrow() {
  const supabase = useMemo(() => createClient(), [])
  const { deployEscrow } = useInitializeEscrow()
  const { sendTransaction } = useSendTransaction()
  const { fundEscrow } = useFundEscrow()
  const { approveMilestone } = useApproveMilestone()
  const { releaseFunds } = useReleaseFunds()
  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
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
        const amount = repaymentEscrowAmount(params.principal, profit)
        const engagementId = repaymentEngagementId(params.dealId)

        const payload: InitializeSingleReleaseEscrowPayload = {
          signer: params.pymeAddress,
          engagementId,
          title: `Repayment · ${params.productName}`,
          description: `SMB repayment of principal + interest for deal ${params.dealId}`,
          roles: {
            approver: MERCATO_PLATFORM_ADDRESS,
            serviceProvider: params.investorAddress,
            platformAddress: MERCATO_PLATFORM_ADDRESS,
            releaseSigner: MERCATO_PLATFORM_ADDRESS,
            disputeResolver: MERCATO_PLATFORM_ADDRESS,
            receiver: params.investorAddress,
          },
          amount: Math.round(amount * 100) / 100,
          platformFee: PLATFORM_FEE_PERCENT,
          trustline: {
            address: USDC_TRUSTLINE.address,
            symbol: USDC_TRUSTLINE.symbol,
          },
          milestones: [
            {
              description: 'Repay investor principal plus agreed interest',
            },
          ],
        }

        const deployResponse = await deployEscrow(payload, 'single-release')
        if (deployResponse.status !== 'SUCCESS' || !deployResponse.unsignedTransaction) {
          throw new Error('Failed to create repayment escrow transaction')
        }

        let contractId: string | undefined

        if (params.provider === 'pollar') {
          await pollar.signAndSubmitTx(deployResponse.unsignedTransaction)
          for (let attempt = 0; attempt < 5; attempt++) {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 3000))
            try {
              const escrows = await getEscrowsBySigner({ signer: params.pymeAddress })
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
            address: params.pymeAddress,
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

        const dueAt = new Date()
        dueAt.setDate(dueAt.getDate() + Math.max(1, params.termDays))

        const { error } = await supabase
          .from('deals')
          .update({
            escrow_id: engagementId,
            escrow_contract_address: contractId,
            escrow_status: 'initialized',
            repayment_status: 'escrow_initialized',
            repayment_due_at: dueAt.toISOString(),
          })
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
        const payload: FundEscrowPayload = {
          contractId: params.contractId,
          signer: params.pymeAddress,
          amount: params.amount,
        }
        const fundResponse = await fundEscrow(payload, 'single-release')
        if (fundResponse.status !== 'SUCCESS' || !fundResponse.unsignedTransaction) {
          throw new Error('Failed to build repayment fund transaction')
        }
        await signAndSend(
          fundResponse.unsignedTransaction,
          params.pymeAddress,
          params.provider,
        )
      } finally {
        setIsWorking(false)
      }
    },
    [fundEscrow, signAndSend],
  )

  const approveAndReleaseRepayment = useCallback(
    async (params: ReleaseRepaymentParams) => {
      setIsWorking(true)
      try {
        const approveResponse = await approveMilestone(
          {
            contractId: params.contractId,
            milestoneIndex: '0',
            approver: params.releaseSigner,
          },
          'single-release',
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

        const releaseResponse = await releaseFunds(
          {
            contractId: params.contractId,
            releaseSigner: params.releaseSigner,
          },
          'single-release',
        )
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
      } finally {
        setIsWorking(false)
      }
    },
    [approveMilestone, releaseFunds, signAndSend],
  )

  return {
    isWorking,
    deployRepaymentEscrow,
    fundRepaymentEscrow,
    approveAndReleaseRepayment,
  }
}
