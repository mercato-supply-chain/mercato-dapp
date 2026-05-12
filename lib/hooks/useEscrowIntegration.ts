'use client'

import { useState } from 'react'
import {
  useInitializeEscrow,
  useSendTransaction,
  useGetEscrowsFromIndexerBySigner,
} from '@trustless-work/escrow/hooks'
import type {
  InitializeMultiReleaseEscrowPayload,
  EscrowType,
} from '@trustless-work/escrow'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { usePollarSession } from '@/providers/pollar-provider'
import { loadStoredWallet } from '@/lib/mercato-wallet'
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
  const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
  const pollar = usePollarSession()

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

      setTxState('pending')

      const activeWallet = loadStoredWallet()
      let contractAddress: string | undefined

      if (activeWallet?.provider === 'pollar') {
        // Pollar embedded wallet: sign + submit via Pollar, then resolve contract ID from indexer
        await pollar.signAndSubmitTx(deployResponse.unsignedTransaction)

        const maxAttempts = 5
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 3000))
          }
          try {
            const escrows = await getEscrowsBySigner({ signer: params.signer })
            const match = escrows.find((e) => e.engagementId === params.engagementId)
            if (match?.contractId) {
              contractAddress = match.contractId
              break
            }
          } catch {
            // Indexer might not have caught up yet — retry
          }
        }
      } else {
        // Stellar Wallets Kit: sign then submit via Trustless Work API
        const signedXdr = await signTransaction({
          unsignedTransaction: deployResponse.unsignedTransaction,
          address: params.signer,
        })

        const sendResponse = await sendTransaction(signedXdr)

        if (sendResponse.status !== 'SUCCESS') {
          throw new Error(
            'message' in sendResponse
              ? sendResponse.message
              : 'Failed to submit transaction'
          )
        }

        contractAddress =
          'contractId' in sendResponse
            ? (sendResponse as { contractId?: string }).contractId
            : ('escrow' in sendResponse
                ? (sendResponse as { escrow?: { contractId?: string } }).escrow?.contractId
                : undefined)
      }

      setTxState('success')
      showSuccess('Transaction confirmed')

      return {
        success: true,
        escrowId: params.engagementId,
        contractAddress,
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
