'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Horizon } from '@stellar/stellar-sdk'
import { DefindexSDK, SupportedNetworks, DepositParams, WithdrawParams } from '@defindex/sdk'
import { useWalletContext } from '@/providers/wallet-provider'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { executeTransaction } from '@/lib/stellar-submit'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import { showLoading, showSuccess, showError } from '@/hooks/use-toast'
import type { TxState } from '@/lib/types'

const isTestnet = process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK !== 'mainnet'
const HORIZON_URL = isTestnet
  ? 'https://horizon-testnet.stellar.org'
  : 'https://horizon.stellar.org'
const DEFINDEX_NETWORK = isTestnet
  ? SupportedNetworks.TESTNET
  : SupportedNetworks.MAINNET

const USDC_ISSUER = USDC_TRUSTLINE.address

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

interface UseDefindexResult {
  walletBalance: number
  vaultBalance: number
  txState: TxState
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  depositToVault: (params: DepositToVaultParams) => Promise<DepositResult>
  withdrawFromVault: (params: WithdrawFromVaultParams) => Promise<WithdrawResult>
}

export function useDefindex(): UseDefindexResult {
  const { walletInfo } = useWalletContext()
  const address = walletInfo?.address ?? null

  const [walletBalance, setWalletBalance] = useState(0)
  const [vaultBalance, setVaultBalance] = useState(0)
  const [txState, setTxState] = useState<TxState>('idle')
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(0)

  const fetchBalances = useCallback(async () => {
    if (!address) {
      setWalletBalance(0)
      setVaultBalance(0)
      setError(null)
      return
    }

    const requestId = ++cancelRef.current
    setBalancesLoading(true)
    setError(null)

    try {
      const wallet = await fetchWalletUsdc(address)
      const vault = await fetchVaultBalance(address)
      if (cancelRef.current !== requestId) return
      setWalletBalance(wallet)
      setVaultBalance(vault)
    } catch (err) {
      if (cancelRef.current !== requestId) return
      const message = err instanceof Error ? err.message : 'Failed to load balances'
      setError(message)
    } finally {
      if (cancelRef.current === requestId) setBalancesLoading(false)
    }
  }, [address])

  useEffect(() => {
    void fetchBalances()
  }, [fetchBalances])

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
    walletBalance,
    vaultBalance,
    txState,
    isLoading: balancesLoading || txState === 'loading' || txState === 'pending',
    error,
    refresh: fetchBalances,
    depositToVault,
    withdrawFromVault,
  }
}

async function fetchWalletUsdc(address: string): Promise<number> {
  if (!USDC_ISSUER) return 0
  try {
    const server = new Horizon.Server(HORIZON_URL)
    const account = await server.loadAccount(address)
    const usdc = account.balances.find(
      (b) =>
        b.asset_type !== 'native' &&
        'asset_code' in b &&
        b.asset_code === USDC_TRUSTLINE.symbol &&
        'asset_issuer' in b &&
        b.asset_issuer === USDC_ISSUER,
    )
    if (!usdc) return 0
    return Number.parseFloat(usdc.balance) || 0
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'response' in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) {
      return 0
    }
    throw err
  }
}

async function fetchVaultBalance(_address: string): Promise<number> {
  // DeFindex vault balance is wired in issue #3. Until the SDK integration ships
  // the dashboard treats vault holdings as zero so the UI stays consistent.
  return 0
}
