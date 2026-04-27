'use client'

import { useState } from 'react'
import { DefindexSDK, SupportedNetworks, DepositParams, WithdrawParams } from '@defindex/sdk'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { executeTransaction } from '@/lib/stellar-submit'
import { useWalletContext } from '@/providers/wallet-provider'
import { showLoading, showSuccess, showError } from '@/hooks/use-toast'
import type { TxState } from '@/lib/types'

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
  const [txState, setTxState] = useState<TxState>('idle')
  const [error, setError] = useState<string | null>(null)
  const { walletInfo } = useWalletContext()

  const depositToVault = async (
    params: DepositToVaultParams
  ): Promise<DepositResult> => {
    setTxState('loading')
    setError(null)
    showLoading('Submitting deposit...')

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

      setTxState('pending')
      const result = await executeTransaction(signedXdr, setTxState)
      showSuccess('Deposit confirmed')

      return {
        success: true,
        txHash: result.hash,
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to deposit to vault'
      setError(errorMessage)
      setTxState('error')
      showError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  const withdrawFromVault = async (
    params: WithdrawFromVaultParams
  ): Promise<WithdrawResult> => {
    setTxState('loading')
    setError(null)
    showLoading('Submitting withdrawal...')

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

      setTxState('pending')
      const result = await executeTransaction(signedXdr, setTxState)
      showSuccess('Withdrawal confirmed')

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
      setTxState('error')
      showError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  return {
    depositToVault,
    withdrawFromVault,
    txState,
    isLoading: txState === 'loading' || txState === 'pending',
    error,
  }
}
