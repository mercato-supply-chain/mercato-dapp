'use client'

import { useState } from 'react'
import { DefindexSDK, SupportedNetworks, DepositParams, WithdrawParams } from '@defindex/sdk'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { submitSignedTransaction } from '@/lib/stellar-submit'
import { useWalletContext } from '@/providers/wallet-provider'

const isTestnet = process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK !== 'mainnet'
const DEFINDEX_NETWORK = isTestnet
  ? SupportedNetworks.TESTNET
  : SupportedNetworks.MAINNET

export interface DepositToVaultParams {
  vaultAddress: string
  amount: number
}

export interface DepositResult {
  success: boolean
  txHash?: string
  error?: string
}

export interface WithdrawFromVaultParams {
  vaultAddress: string
  amount: number
}

export interface WithdrawResult {
  success: boolean
  txHash?: string
  error?: string
}

export function useDefindex() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { walletInfo } = useWalletContext()

  const depositToVault = async (
    params: DepositToVaultParams
  ): Promise<DepositResult> => {
    setIsLoading(true)
    setError(null)

    try {
      if (!params.amount || params.amount <= 0) {
        throw new Error('Invalid amount: must be greater than 0')
      }

      if (!walletInfo?.address) {
        throw new Error('Wallet not connected')
      }

      const apiKey = process.env.NEXT_PUBLIC_DEFINDEX_API_KEY
      if (!apiKey) {
        throw new Error('DeFindex API key not configured')
      }

      const sdk = new DefindexSDK({
        apiKey,
        baseUrl: process.env.NEXT_PUBLIC_DEFINDEX_API_URL,
      })

      const depositData: DepositParams = {
        amounts: [params.amount],
        caller: walletInfo.address,
        invest: true,
        slippageBps: 100,
      }

      const depositResponse = await sdk.depositToVault(
        params.vaultAddress,
        depositData,
        DEFINDEX_NETWORK
      )

      if (!depositResponse.xdr) {
        throw new Error('Failed to create deposit transaction')
      }

      const signedXdr = await signTransaction({
        unsignedTransaction: depositResponse.xdr,
        address: walletInfo.address,
      })

      const result = await submitSignedTransaction(signedXdr)

      return {
        success: true,
        txHash: result.hash,
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to deposit to vault'
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsLoading(false)
    }
  }

  const withdrawFromVault = async (
    params: WithdrawFromVaultParams
  ): Promise<WithdrawResult> => {
    setIsLoading(true)
    setError(null)

    try {
      if (!params.amount || params.amount <= 0) {
        throw new Error('Invalid amount: must be greater than 0')
      }

      if (!walletInfo?.address) {
        throw new Error('Wallet not connected')
      }

      const apiKey = process.env.NEXT_PUBLIC_DEFINDEX_API_KEY
      if (!apiKey) {
        throw new Error('DeFindex API key not configured')
      }

      const sdk = new DefindexSDK({
        apiKey,
        baseUrl: process.env.NEXT_PUBLIC_DEFINDEX_API_URL,
      })

      const vaultBalance = await sdk.getVaultBalance(
        params.vaultAddress,
        walletInfo.address,
        DEFINDEX_NETWORK
      )

      const availableBalance = vaultBalance?.underlyingBalance?.[0] ?? 0
      if (availableBalance < params.amount) {
        throw new Error('Insufficient vault balance')
      }

      const withdrawData: WithdrawParams = {
        amounts: [params.amount],
        caller: walletInfo.address,
        slippageBps: 100,
      }

      const withdrawResponse = await sdk.withdrawFromVault(
        params.vaultAddress,
        withdrawData,
        DEFINDEX_NETWORK
      )

      if (!withdrawResponse.xdr) {
        throw new Error('Failed to create withdraw transaction')
      }

      const signedXdr = await signTransaction({
        unsignedTransaction: withdrawResponse.xdr,
        address: walletInfo.address,
      })

      const result = await submitSignedTransaction(signedXdr)

      return {
        success: true,
        txHash: result.hash,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      const errorMessage = message.toLowerCase().includes('insufficient')
        ? 'Insufficient vault balance'
        : message || 'Failed to withdraw from vault'
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
    depositToVault,
    withdrawFromVault,
    isLoading,
    error,
  }
}

// Test manual: en cualquier componente con wallet conectada,
// llamar: await depositToVault({ vaultAddress: "VAULT_ADDR", amount: 1000000 })
// llamar: await withdrawFromVault({ vaultAddress: "VAULT_ADDR", amount: 5000000 })
