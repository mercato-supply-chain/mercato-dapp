'use client'

import { useState } from 'react'
import {
  useInitializeEscrow,
  useSendTransaction,
} from '@trustless-work/escrow/hooks'
import type {
  InitializeMultiReleaseEscrowPayload,
  EscrowType,
} from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import { MERCATO_PLATFORM_ADDRESS } from '@/lib/trustless/config'
import { showLoading, showSuccess, showError } from '@/hooks/use-toast'
import type { TxState } from '@/lib/types'

export interface EscrowMilestone {
  description: string
  amount: number
  receiver: string
}

export interface InitializeEscrowParams {
  signer: string
  engagementId: string
  title: string
  description: string
  approver: string
  serviceProvider: string
  platformFee: number
  milestones: EscrowMilestone[]
}

export function useEscrowIntegration() {
  const [txState, setTxState] = useState<TxState>('idle')
  const [error, setError] = useState<string | null>(null)

  const { deployEscrow } = useInitializeEscrow()
  const { sendTransaction } = useSendTransaction()

  const initializeAndDeployEscrow = async (
    params: InitializeEscrowParams
  ): Promise<{
    success: boolean
    escrowId?: string
    contractAddress?: string
    transactionHash?: string
    error?: string
  }> => {
    setTxState('loading')
    setError(null)
    showLoading('Submitting transaction...')

    try {
      if (!MERCATO_PLATFORM_ADDRESS) {
        throw new Error('MERCATO platform address not configured')
      }

      const payload: InitializeMultiReleaseEscrowPayload = {
        signer: params.signer,
        engagementId: params.engagementId,
        title: params.title,
        description: params.description,
        roles: {
          approver: params.approver,
          serviceProvider: params.serviceProvider,
          platformAddress: MERCATO_PLATFORM_ADDRESS,
          releaseSigner: MERCATO_PLATFORM_ADDRESS,
          disputeResolver: MERCATO_PLATFORM_ADDRESS,
        },
        platformFee: params.platformFee,
        milestones: params.milestones.map((m) => ({
          description: m.description,
          amount: m.amount,
          receiver: m.receiver,
        })),
        trustline: {
          address: USDC_TRUSTLINE.address,
          symbol: USDC_TRUSTLINE.symbol,
        },
      }

      const deployResponse = await deployEscrow(
        payload,
        'multi-release' as EscrowType
      )

      if (
        deployResponse.status !== 'SUCCESS' ||
        !deployResponse.unsignedTransaction
      ) {
        throw new Error('Failed to create escrow transaction')
      }

      const signedXdr = await signTransaction({
        unsignedTransaction: deployResponse.unsignedTransaction,
        address: params.signer,
      })

      setTxState('pending')
      const sendResponse = await sendTransaction(signedXdr)

      if (sendResponse.status !== 'SUCCESS') {
        throw new Error(
          'message' in sendResponse
            ? sendResponse.message
            : 'Failed to submit transaction'
        )
      }

      setTxState('success')
      showSuccess('Transaction confirmed')

      const contractId =
        'contractId' in sendResponse ? sendResponse.contractId : undefined
      const escrowData =
        'escrow' in sendResponse ? sendResponse.escrow : undefined

      return {
        success: true,
        escrowId: params.engagementId,
        contractAddress: contractId ?? escrowData?.contractId,
        transactionHash: undefined,
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to initialize escrow'
      setError(errorMessage)
      setTxState('error')
      showError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  return {
    initializeAndDeployEscrow,
    txState,
    isLoading: txState === 'loading' || txState === 'pending',
    error,
  }
}
