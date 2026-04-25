'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Horizon } from '@stellar/stellar-sdk'
import {
  DefindexSDK,
  SupportedNetworks,
  type DepositParams,
  type WithdrawParams,
} from '@defindex/sdk'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { submitSignedTransaction } from '@/lib/stellar-submit'
import { useWalletContext } from '@/providers/wallet-provider'
import { USDC_TRUSTLINE } from '@/lib/trustless/trustlines'
import { buildCapitalState } from '@/lib/capital'
import type { CapitalState } from '@/lib/types'

const HORIZON_URL =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org'

const USDC_ISSUER = USDC_TRUSTLINE.address
const isTestnet = process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK !== 'mainnet'
const DEFINDEX_NETWORK = isTestnet
  ? SupportedNetworks.TESTNET
  : SupportedNetworks.MAINNET

function getDefindexSdk(): DefindexSDK | null {
  const apiKey = process.env.NEXT_PUBLIC_DEFINDEX_API_KEY
  if (!apiKey) return null
  return new DefindexSDK({
    apiKey,
    baseUrl: process.env.NEXT_PUBLIC_DEFINDEX_API_URL,
  })
}

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

async function fetchVaultUsdc(
  userAddress: string,
  network: SupportedNetworks,
): Promise<number> {
  const vaultAddress = process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS
  if (!vaultAddress) return 0
  const sdk = getDefindexSdk()
  if (!sdk) return 0
  const res = await sdk.getVaultBalance(vaultAddress, userAddress, network)
  const raw = res.underlyingBalance
  if (!raw?.length) return 0
  return Number(raw[0]) || 0
}

export function useDefindex() {
  const { walletInfo } = useWalletContext()
  const address = walletInfo?.address ?? null

  const [walletBalance, setWalletBalance] = useState(0)
  const [vaultBalance, setVaultBalance] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isTransactionLoading, setIsTransactionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(0)
  const refreshInFlight = useRef<Promise<void> | null>(null)
  const addressRef = useRef<string | null>(null)

  const capitalState: CapitalState = useMemo(
    () =>
      buildCapitalState({
        wallet: walletBalance,
        inVault: vaultBalance,
        allocated: 0,
      }),
    [walletBalance, vaultBalance],
  )

  const refreshCapitalState = useCallback(async () => {
    if (refreshInFlight.current) {
      return refreshInFlight.current
    }
    if (!address) {
      setWalletBalance(0)
      setVaultBalance(0)
      setError(null)
      return
    }

    const run = (async () => {
      const requestId = ++cancelRef.current
      setIsSyncing(true)
      setError(null)
      try {
        const wallet = await fetchWalletUsdc(address)
        const vault = await fetchVaultUsdc(address, DEFINDEX_NETWORK)
        if (cancelRef.current !== requestId) return
        setWalletBalance(wallet)
        setVaultBalance(vault)
      } catch (err) {
        if (cancelRef.current !== requestId) return
        const message = err instanceof Error ? err.message : 'Failed to load balances'
        setError(message)
      } finally {
        if (cancelRef.current === requestId) setIsSyncing(false)
      }
    })()

    refreshInFlight.current = run.finally(() => {
      refreshInFlight.current = null
    })
    return refreshInFlight.current
  }, [address])

  useEffect(() => {
    if (address === addressRef.current) return
    addressRef.current = address
    if (!address) {
      cancelRef.current += 1
      setWalletBalance(0)
      setVaultBalance(0)
      setError(null)
      return
    }
    cancelRef.current += 1
    setWalletBalance(0)
    setVaultBalance(0)
    void refreshCapitalState()
  }, [address, refreshCapitalState])

  const getVaultBalance = useCallback(
    async (userAddress: string): Promise<number> => {
      return fetchVaultUsdc(userAddress, DEFINDEX_NETWORK)
    },
    [],
  )

  const depositToVault = useCallback(
    async (params: DepositToVaultParams): Promise<DepositResult> => {
      setIsTransactionLoading(true)
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
        const sdk = getDefindexSdk()
        if (!sdk) {
          throw new Error('DeFindex API key not configured')
        }
        const depositData: DepositParams = {
          amounts: [params.amount],
          caller: walletInfo.address,
          invest: true,
          slippageBps: 100,
        }
        const depositResponse = await sdk.depositToVault(
          params.vaultAddress,
          depositData,
          DEFINDEX_NETWORK,
        )
        if (!depositResponse.xdr) {
          throw new Error('Failed to create deposit transaction')
        }
        const signedXdr = await signTransaction({
          unsignedTransaction: depositResponse.xdr,
          address: walletInfo.address,
        })
        const result = await submitSignedTransaction(signedXdr)
        await refreshCapitalState()
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
        setIsTransactionLoading(false)
      }
    },
    [walletInfo?.address, refreshCapitalState],
  )

  const withdrawFromVault = useCallback(
    async (params: WithdrawFromVaultParams): Promise<WithdrawResult> => {
      setIsTransactionLoading(true)
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
        const sdk = getDefindexSdk()
        if (!sdk) {
          throw new Error('DeFindex API key not configured')
        }
        const vaultData = await sdk.getVaultBalance(
          params.vaultAddress,
          walletInfo.address,
          DEFINDEX_NETWORK,
        )
        const availableBalance = vaultData?.underlyingBalance?.[0] ?? 0
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
          DEFINDEX_NETWORK,
        )
        if (!withdrawResponse.xdr) {
          throw new Error('Failed to create withdraw transaction')
        }
        const signedXdr = await signTransaction({
          unsignedTransaction: withdrawResponse.xdr,
          address: walletInfo.address,
        })
        const result = await submitSignedTransaction(signedXdr)
        await refreshCapitalState()
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
        setIsTransactionLoading(false)
      }
    },
    [walletInfo?.address, refreshCapitalState],
  )

  return {
    depositToVault,
    withdrawFromVault,
    getVaultBalance,
    refreshCapitalState,
    refresh: refreshCapitalState,
    walletBalance,
    vaultBalance,
    capitalState,
    isSyncing,
    isLoading: isSyncing,
    isTransactionLoading,
    error,
  }
}
