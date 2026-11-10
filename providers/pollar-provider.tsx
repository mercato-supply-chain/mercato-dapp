'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { PollarProvider as SDKPollarProvider, usePollar } from '@pollar/react'
import {
  isWalletNotReady,
  type PollarClient,
  type PollarLoginOptions,
  type PollarPersistedSession,
  type SubmitOutcome,
  type TxHistoryState,
  type WalletBalanceState,
  type WalletInfo,
} from '@pollar/core'

type PollarSessionValue = {
  session: PollarPersistedSession | null
  isLoading: boolean
  isAuthenticated: boolean
  /** True once Pollar has confirmed the session (not an optimistic restore). */
  verified: boolean
  /** True when a publishable key is present and the SDK provider is mounted. */
  isConfigured: boolean
  /** True when the embedded SDK is mounted (safe to call openLoginModal). */
  isPollarEmbedReady: boolean
  wallet: WalletInfo | null
  walletAddress: string
  txHistory: TxHistoryState
  walletBalance: WalletBalanceState
  login: (options: PollarLoginOptions) => void
  logout: () => void
  openLoginModal: () => void
  refreshWalletBalance: () => Promise<void>
  getClient: () => PollarClient
  /**
   * Sign an unsigned transaction XDR with the Pollar embedded wallet and submit it to Stellar.
   * Returns the transaction hash on success. Throws on failure.
   */
  signAndSubmitTx: (unsignedXdr: string) => Promise<string>
}

const emptyContext: PollarSessionValue = {
  session: null,
  isLoading: false,
  isAuthenticated: false,
  verified: false,
  isConfigured: false,
  isPollarEmbedReady: false,
  wallet: null,
  walletAddress: '',
  txHistory: { step: 'idle' },
  walletBalance: { step: 'idle' },
  login: () => undefined,
  logout: () => undefined,
  openLoginModal: () => undefined,
  refreshWalletBalance: async () => undefined,
  getClient: () => {
    throw new Error('Pollar provider is not configured')
  },
  signAndSubmitTx: async () => {
    throw new Error('Pollar provider is not configured')
  },
}

const PollarSessionContext = createContext<PollarSessionValue>(emptyContext)

function readAuthenticatedSession(
  client: PollarClient,
  isAuthenticated: boolean,
): PollarPersistedSession | null {
  if (!isAuthenticated) return null
  const state = client.getAuthState()
  return state.step === 'authenticated' ? state.session : null
}

function hashFromSubmitOutcome(outcome: SubmitOutcome): string {
  if (outcome.status === 'success' || outcome.status === 'pending') {
    return outcome.hash
  }
  if (outcome.status === 'cosign_pending') {
    throw new Error('Approve this transaction on your Pollar wallet device to continue.')
  }
  if (isWalletNotReady(outcome)) {
    throw new Error('Pollar is still creating this Stellar account. Try again in a few seconds.')
  }
  throw new Error(
    outcome.message || outcome.details || outcome.code || 'Transaction failed',
  )
}

function PollarSessionBridge({ children }: { children: ReactNode }) {
  const {
    login,
    logout,
    openLoginModal,
    isAuthenticated,
    verified,
    wallet,
    txHistory,
    walletBalance,
    refreshWalletBalance,
    getClient,
    signAndSubmitTx: sdkSignAndSubmitTx,
  } = usePollar()
  const client = getClient()
  const session = useMemo(
    () => readAuthenticatedSession(client, isAuthenticated),
    [client, isAuthenticated, verified, wallet?.address],
  )
  const isLoading = isAuthenticated && !verified
  const walletAddress = wallet?.address ?? ''

  const signAndSubmitTx = useCallback(
    async (unsignedXdr: string): Promise<string> => {
      if (!verified) {
        throw new Error('Pollar session is still restoring. Wait a moment and try again.')
      }
      if (!wallet?.address) {
        throw new Error('Pollar wallet is not ready yet.')
      }
      if (wallet.provisioning === 'CREATING') {
        throw new Error('Pollar is still creating this Stellar account. Try again in a few seconds.')
      }
      const outcome = await sdkSignAndSubmitTx(unsignedXdr)
      return hashFromSubmitOutcome(outcome)
    },
    [sdkSignAndSubmitTx, verified, wallet],
  )

  const value = useMemo<PollarSessionValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated,
      verified,
      isConfigured: true,
      isPollarEmbedReady: true,
      wallet,
      walletAddress,
      txHistory,
      walletBalance,
      login,
      logout,
      openLoginModal,
      refreshWalletBalance,
      getClient,
      signAndSubmitTx,
    }),
    [
      session,
      isLoading,
      isAuthenticated,
      verified,
      wallet,
      walletAddress,
      txHistory,
      walletBalance,
      login,
      logout,
      openLoginModal,
      refreshWalletBalance,
      getClient,
      signAndSubmitTx,
    ],
  )

  return <PollarSessionContext.Provider value={value}>{children}</PollarSessionContext.Provider>
}

export function PollarProvider({
  children,
}: {
  children: ReactNode
}) {
  const apiKey = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY
  const network: 'mainnet' | 'testnet' =
    process.env.NEXT_PUBLIC_POLLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  const clientMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )

  const clientConfig = useMemo(
    () =>
      apiKey
        ? {
            apiKey,
            stellarNetwork: network,
          }
        : null,
    [apiKey, network],
  )

  if (!apiKey || !clientConfig) {
    return <PollarSessionContext.Provider value={emptyContext}>{children}</PollarSessionContext.Provider>
  }

  // PollarClient must not be constructed during RSC prerender.
  if (!clientMounted) {
    return <PollarSessionContext.Provider value={emptyContext}>{children}</PollarSessionContext.Provider>
  }

  return (
    <SDKPollarProvider client={clientConfig}>
      <PollarSessionBridge>{children}</PollarSessionBridge>
    </SDKPollarProvider>
  )
}

export function usePollarSession(): PollarSessionValue {
  return useContext(PollarSessionContext)
}
