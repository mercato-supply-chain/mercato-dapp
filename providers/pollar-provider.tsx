'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import '@pollar/react/styles.css'
import { PollarProvider as SDKPollarProvider, usePollar } from '@pollar/react'
import {
  isWalletNotReady,
  PollarClient,
  type PollarClientConfig,
  type PollarLoginOptions,
  type PollarPersistedSession,
  type SubmitOutcome,
  type TxHistoryState,
  type WalletBalanceState,
  type WalletInfo,
} from '@pollar/core'
import { getEmbeddedWalletId } from '@/lib/mercato-wallet'
import { useOptionalNavAuth } from '@/components/providers/nav-auth-provider'
import {
  clearAllRevokedPollarSessionKeys,
  clearPollarHydrationBlockForUser,
  isPollarSessionKeyRevoked,
  registerActiveWalletSessionCleanup,
  revokePollarSessionKey,
  writeStoredWalletOwnerId,
} from '@/lib/wallet/session-cleanup'

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

let sharedPollarClient: PollarClient | null = null

function getSharedPollarClient(config: PollarClientConfig): PollarClient {
  if (sharedPollarClient && sharedPollarClient.apiKey === config.apiKey) {
    return sharedPollarClient
  }
  sharedPollarClient = new PollarClient(config)
  return sharedPollarClient
}

const cachedClientSessions = new WeakMap<
  object,
  { fingerprint: string; session: PollarPersistedSession }
>()

function readAuthenticatedSession(
  client: PollarClient,
  isAuthenticated: boolean,
): PollarPersistedSession | null {
  if (!isAuthenticated) return null
  const state = client.getAuthState()
  if (state.step !== 'authenticated' || !state.session) return null
  const next = state.session
  // Exclude `wallet.provisioning` / transient wallet metadata from the session fingerprint:
  // live provisioning status is exposed directly via `PollarSessionBridge.wallet`, and changing
  // `pollar.session` identity during `CREATING -> READY` would cancel an in-flight `/api/auth/pollar-sync`.
  const fingerprint = [
    next.userId ?? '',
    next.clientSessionId ?? '',
    getEmbeddedWalletId(next) ?? '',
    next.token?.accessToken ?? '',
    next.token?.refreshToken ?? '',
  ].join('|')
  const cached = cachedClientSessions.get(client)
  if (cached && cached.fingerprint === fingerprint) {
    return cached.session
  }
  cachedClientSessions.set(client, { fingerprint, session: next })
  return next
}

function getPollarSessionKeys(
  session: PollarPersistedSession | null,
  walletAddress: string,
): string[] {
  const keys: string[] = []
  if (session?.clientSessionId) {
    keys.push(`csid:${session.clientSessionId}`)
  }
  if (session?.userId) {
    keys.push(`uid:${session.userId}`)
  }
  const token = session?.token?.accessToken
  if (token) {
    keys.push(`token:${token}`)
  }
  const sessionAddr = session?.wallet?.address
  if (sessionAddr) {
    keys.push(`addr:${sessionAddr}`)
  }
  if (walletAddress && walletAddress !== sessionAddr) {
    keys.push(`addr:${walletAddress}`)
  }
  return keys
}

function revokeAllKeysForSession(
  session: PollarPersistedSession | null,
  walletAddress: string,
): boolean {
  const keys = getPollarSessionKeys(session, walletAddress)
  for (const key of keys) {
    revokePollarSessionKey(key)
  }
  return keys.length > 0
}

function isAnyKeyRevokedForSession(
  session: PollarPersistedSession | null,
  walletAddress: string,
): boolean {
  const keys = getPollarSessionKeys(session, walletAddress)
  return keys.some((key) => isPollarSessionKeyRevoked(key))
}

type PendingInteractiveLoginSnapshot = {
  hadActiveSdkSession: boolean
  preClientSessionId: string | null
  preUserId: string | null
  preAccessToken: string | null
  preWalletAddress: string | null
  sawNonAuthenticatedStep: boolean
}

function isGenuineNewInteractiveSession(
  pending: PendingInteractiveLoginSnapshot,
  authState: {
    step?: string
    session?: PollarPersistedSession | null
  },
): boolean {
  if (!pending.hadActiveSdkSession) return true
  if (pending.sawNonAuthenticatedStep) return true
  const nextSession = authState.session ?? null
  const nextCsid = nextSession?.clientSessionId ?? null
  if (pending.preClientSessionId || nextCsid) {
    return Boolean(nextCsid && nextCsid !== pending.preClientSessionId)
  }
  const nextUid = nextSession?.userId ?? null
  if (pending.preUserId || nextUid) {
    return Boolean(nextUid && nextUid !== pending.preUserId)
  }
  const nextToken = nextSession?.token?.accessToken ?? null
  if (nextToken && nextToken !== pending.preAccessToken) {
    return true
  }
  const nextAddr = nextSession?.wallet?.address ?? null
  return Boolean(nextAddr && nextAddr !== pending.preWalletAddress)
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
    login: sdkLogin,
    logout: sdkLogout,
    openLoginModal: sdkOpenLoginModal,
    isAuthenticated: sdkIsAuthenticated,
    verified: sdkVerified,
    wallet: sdkWallet,
    txHistory,
    walletBalance,
    refreshWalletBalance,
    getClient,
    signAndSubmitTx: sdkSignAndSubmitTx,
  } = usePollar()
  const navAuth = useOptionalNavAuth()
  const activeUserId = navAuth?.user?.id ?? null
  const activeUserIdRef = useRef<string | null>(activeUserId)
  useEffect(() => {
    activeUserIdRef.current = activeUserId
  }, [activeUserId])

  const pendingInteractiveLoginRef = useRef<PendingInteractiveLoginSnapshot | null>(null)
  const [revocationEpoch, setRevocationEpoch] = useState(0)
  const [, setAuthRevision] = useState(0)
  const client = getClient()
  const rawWalletAddress = sdkWallet?.address ?? ''
  const rawSession = readAuthenticatedSession(client, sdkIsAuthenticated)
  const sessionKeysSignature = getPollarSessionKeys(rawSession, rawWalletAddress).join('|')
  const isRevoked = useMemo(() => {
    void revocationEpoch
    void sessionKeysSignature
    return isAnyKeyRevokedForSession(rawSession, rawWalletAddress)
  }, [rawSession, rawWalletAddress, revocationEpoch, sessionKeysSignature])

  // Once the SDK itself reaches idle (`!sdkIsAuthenticated`), no hung in-memory session
  // remains, so temporary revocation masks can be cleared safely for future same-tab logins.
  useEffect(() => {
    if (!sdkIsAuthenticated) {
      clearAllRevokedPollarSessionKeys()
    }
  }, [sdkIsAuthenticated])

  // Subscribe directly to PollarClient auth transitions so background silent token refreshes
  // (`_doResume` / `_scheduleNextRefresh`) and `<LoginModal>` session swaps propagate immediately.
  useEffect(() => {
    const maybeSubscribe = (
      client as unknown as {
        onAuthStateChange?: (
          cb: (authState: { step?: string; session?: PollarPersistedSession | null }) => void,
        ) => () => void
      }
    )?.onAuthStateChange
    if (typeof maybeSubscribe !== 'function') return undefined
    return maybeSubscribe.call(client, (authState) => {
      const pending = pendingInteractiveLoginRef.current
      if (authState?.step === 'authenticated') {
        if (pending && isGenuineNewInteractiveSession(pending, authState)) {
          pendingInteractiveLoginRef.current = null
          clearAllRevokedPollarSessionKeys()
          clearPollarHydrationBlockForUser()
          setRevocationEpoch((n) => n + 1)
        }
      } else {
        if (pending) {
          pending.sawNonAuthenticatedStep = true
        }
        if (authState?.step === 'idle' || authState?.step === 'unauthenticated') {
          clearAllRevokedPollarSessionKeys()
        }
      }
      setAuthRevision((n) => n + 1)
    })
  }, [client])

  const isAuthenticated = sdkIsAuthenticated && !isRevoked
  const verified = sdkVerified && !isRevoked
  const session = isRevoked ? null : rawSession
  const wallet = isRevoked ? null : sdkWallet
  const isLoading = isAuthenticated && !verified
  const walletAddress = wallet?.address ?? ''

  const prepareInteractivePollarLogin = useCallback(() => {
    if (!sdkIsAuthenticated) {
      pendingInteractiveLoginRef.current = {
        hadActiveSdkSession: false,
        preClientSessionId: null,
        preUserId: null,
        preAccessToken: null,
        preWalletAddress: null,
        sawNonAuthenticatedStep: true,
      }
      clearAllRevokedPollarSessionKeys()
      clearPollarHydrationBlockForUser()
    } else {
      const activeSession = readAuthenticatedSession(client, true)
      pendingInteractiveLoginRef.current = {
        hadActiveSdkSession: true,
        preClientSessionId: activeSession?.clientSessionId ?? null,
        preUserId: activeSession?.userId ?? null,
        preAccessToken: activeSession?.token?.accessToken ?? null,
        preWalletAddress: activeSession?.wallet?.address ?? (rawWalletAddress || null),
        sawNonAuthenticatedStep: false,
      }
    }
    if (!activeUserIdRef.current) {
      writeStoredWalletOwnerId(null)
    }
  }, [client, rawWalletAddress, sdkIsAuthenticated])

  const login = useCallback(
    (options: PollarLoginOptions) => {
      prepareInteractivePollarLogin()
      sdkLogin(options)
    },
    [prepareInteractivePollarLogin, sdkLogin],
  )

  const openLoginModal = useCallback(() => {
    prepareInteractivePollarLogin()
    sdkOpenLoginModal()
  }, [prepareInteractivePollarLogin, sdkOpenLoginModal])

  const logout = useCallback(() => {
    pendingInteractiveLoginRef.current = null
    const activeSession = readAuthenticatedSession(client, sdkIsAuthenticated)
    if (revokeAllKeysForSession(activeSession, rawWalletAddress)) {
      setRevocationEpoch((n) => n + 1)
    }
    return sdkLogout()
  }, [client, rawWalletAddress, sdkIsAuthenticated, sdkLogout])

  useEffect(() => {
    return registerActiveWalletSessionCleanup(() => {
      if (!sdkIsAuthenticated) return undefined
      const activeSession = readAuthenticatedSession(client, sdkIsAuthenticated)
      const keys = getPollarSessionKeys(activeSession, rawWalletAddress)
      if (keys.length > 0 && keys.every((k) => isPollarSessionKeyRevoked(k))) {
        return undefined
      }
      return logout()
    })
  }, [client, logout, rawWalletAddress, sdkIsAuthenticated])

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

  const pollarClient = getSharedPollarClient(clientConfig)

  return (
    <SDKPollarProvider client={pollarClient}>
      <PollarSessionBridge>{children}</PollarSessionBridge>
    </SDKPollarProvider>
  )
}

export function usePollarSession(): PollarSessionValue {
  return useContext(PollarSessionContext)
}
