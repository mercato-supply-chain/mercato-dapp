'use client'

import { useState } from 'react'

export interface EscrowMilestone {
  description: string
  amount: string
  receiver: string
}

export interface EscrowRoles {
  approver: string // PyME address
  serviceProvider: string // Supplier address
  platformAddress: string // MERCATO platform address
  releaseSigner: string // Platform or admin address
  disputeResolver: string // Platform or admin address
}

export interface InitializeEscrowPayload {
  signer: string
  engagementId: string
  title: string
  description: string
  roles: EscrowRoles
  platformFee: number
  milestones: EscrowMilestone[]
  trustline: {
    address: string
    symbol: string
  }
}

export function useEscrowIntegration() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initializeEscrow = async (payload: InitializeEscrowPayload) => {
    setIsLoading(true)
    setError(null)

    try {
      // Get API key from environment
      const apiKey = process.env.NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY

      if (!apiKey) {
        throw new Error('TrustlessWork API key not configured')
      }

      // Call TrustlessWork API to deploy escrow
      const response = await fetch('https://dev.api.trustlesswork.com/deployer/multi-release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        unsignedTransaction: data.unsignedTransaction,
        success: true,
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to initialize escrow'
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsLoading(false)
    }
  }

  const sendSignedTransaction = async (signedXdr: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const apiKey = process.env.NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY

      if (!apiKey) {
        throw new Error('TrustlessWork API key not configured')
      }

      const response = await fetch('https://dev.api.trustlesswork.com/helper/send-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ signedXdr }),
      })

      if (!response.ok) {
        throw new Error(`Failed to send transaction: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        status: data.status,
        data: data,
        success: data.status === 'SUCCESS',
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send transaction'
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    initializeEscrow,
    sendSignedTransaction,
    isLoading,
    error,
  }
}
