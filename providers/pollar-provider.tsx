'use client'

import {
  createContext,
  useEffect,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from 'react'
import {
  PollarProvider as SDKPollarProvider,
  usePollar,
  type PollarStyles,
} from '@pollar/react'
import type {
  PollarApplicationConfigContent,
  PollarLoginOptions,
  PollarClient,
  TxHistoryState,
  WalletBalanceState,
  WalletType,
  AuthState,
} from '@pollar/core'

type PollarSessionValue = {
  session: PollarApplicationConfigContent | null
  isLoading: boolean
  isAuthenticated: boolean
  /** True when the embedded SDK is mounted (safe to call openLoginModal). */
  isPollarEmbedReady: boolean
  walletAddress: string
  walletType: WalletType | null
  txHistory: TxHistoryState
  walletBalance: WalletBalanceState
  login: (options: PollarLoginOptions) => void
  logout: () => void
  openLoginModal: () => void
  refreshWalletBalance: () => Promise<void>
  getClient: () => PollarClient
}

const emptyContext: PollarSessionValue = {
  session: null,
  isLoading: false,
  isAuthenticated: false,
  isPollarEmbedReady: false,
  walletAddress: '',
  walletType: null,
  txHistory: { step: 'idle' },
  walletBalance: { step: 'idle' },
  login: () => undefined,
  logout: () => undefined,
  openLoginModal: () => undefined,
  refreshWalletBalance: async () => undefined,
  getClient: () => {
    throw new Error('Pollar provider is not configured')
  },
}

const PollarSessionContext = createContext<PollarSessionValue>(emptyContext)

/**
 * When GET /applications/config fails (wrong origin, key, or network), @pollar/react
 * falls back to empty styles — the login modal then shows only the header/footer with no methods.
 * These defaults ensure users always see signup options; values merge over the empty fetch result.
 * Allowlist your app origin in Pollar Dashboard → Domains so remote branding + config still load.
 */
const POLLAR_LOGIN_FALLBACK_STYLES: PollarStyles = {
  emailEnabled: true,
  embeddedWallets: true,
  providers: {
    google: true,
    github: true,
  },
}

function PollarSessionBridge({ children }: { children: ReactNode }) {
  const {
    login,
    logout,
    openLoginModal,
    walletAddress,
    walletType,
    txHistory,
    walletBalance,
    refreshWalletBalance,
    getClient,
  } = usePollar()
  const [authState, setAuthState] = useState<AuthState>(() => getClient().getAuthState())

  useEffect(() => {
    const client = getClient()
    setAuthState(client.getAuthState())
    return client.onAuthStateChange((state) => setAuthState(state))
  }, [getClient])

  const session = authState.step === 'authenticated' ? authState.session : null
  const isAuthenticated = authState.step === 'authenticated'
  const isLoading =
    authState.step !== 'idle' &&
    authState.step !== 'authenticated' &&
    authState.step !== 'error'

  const value = useMemo<PollarSessionValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated,
      isPollarEmbedReady: true,
      walletAddress,
      walletType,
      txHistory,
      walletBalance,
      login,
      logout,
      openLoginModal,
      refreshWalletBalance,
      getClient,
    }),
    [
      session,
      isLoading,
      isAuthenticated,
      walletAddress,
      walletType,
      txHistory,
      walletBalance,
      login,
      logout,
      openLoginModal,
      refreshWalletBalance,
      getClient,
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
  const network =
    process.env.NEXT_PUBLIC_POLLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  const [clientMounted, setClientMounted] = useState(false)

  const sdkConfig = useMemo(
    () =>
      apiKey
        ? {
            apiKey,
            stellarNetwork: network,
          }
        : null,
    [apiKey, network],
  )

  useEffect(() => {
    setClientMounted(true)
  }, [])

  if (!apiKey || !sdkConfig) {
    return <PollarSessionContext.Provider value={emptyContext}>{children}</PollarSessionContext.Provider>
  }

  // @pollar/core constructs PollarClient in useState; that runs during RSC prerender and logs a warning.
  if (!clientMounted) {
    return <PollarSessionContext.Provider value={emptyContext}>{children}</PollarSessionContext.Provider>
  }

  return (
    <SDKPollarProvider config={sdkConfig} styles={POLLAR_LOGIN_FALLBACK_STYLES}>
      <PollarSessionBridge>{children}</PollarSessionBridge>
    </SDKPollarProvider>
  )
}

export function usePollarSession(): PollarSessionValue {
  return useContext(PollarSessionContext)
}
