'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { type ISupportedWallet } from '@creit.tech/stellar-wallets-kit'
import type { TxHistoryState } from '@pollar/core'
import { createClient } from '@/lib/supabase/client'
import { usePollarSession } from '@/providers/pollar-provider'
import { stellarWalletKit } from '@/lib/trustless/wallet-kit'
import {
  fetchHorizonBalances,
  getEmbeddedWalletId,
  getEmbeddedWalletStatus,
  getWalletAdapterLabel,
  loadStoredWallet,
  saveStoredWallet,
  truncatePublicKey,
  type ConnectedWallet,
  type WalletBalanceSummary,
  type WalletProviderType,
  type WalletStatus,
} from '@/lib/mercato-wallet'

interface WalletContextValue {
  provider: WalletProviderType | null
  publicKey: string | null
  walletId: string | null
  status: WalletStatus | null
  isConnected: boolean
  isEmbedded: boolean
  walletName: string | null
  wallet: ConnectedWallet | null
  walletInfo: { address: string; walletName: string } | null
  truncatedAddress: string | null
  balances: WalletBalanceSummary | null
  txHistory: TxHistoryState | null
  canSignTransactions: boolean
  connectExternalWallet: () => Promise<void>
  connectPollarWallet: () => Promise<void>
  disconnect: () => Promise<void>
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider')
  }
  return context
}

function toWalletInfo(wallet: ConnectedWallet | null) {
  if (!wallet) return null
  return {
    address: wallet.publicKey,
    walletName: getWalletAdapterLabel(wallet.walletName),
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const pollar = usePollarSession()
  const pollarRef = useRef(pollar)
  pollarRef.current = pollar
  const router = useRouter()
  const pathname = usePathname()
  const pollarSupabaseSyncCompletedRef = useRef<string | null>(null)
  const pollarSupabaseSyncInFlightRef = useRef<string | null>(null)
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null)
  const [balances, setBalances] = useState<WalletBalanceSummary | null>(null)
  const [txHistory, setTxHistory] = useState<WalletContextValue['txHistory']>(null)
  const [hasRestored, setHasRestored] = useState(false)

  const persistWallet = useCallback((next: ConnectedWallet | null) => {
    setWallet(next)
    saveStoredWallet(
      next
        ? {
            provider: next.provider,
            publicKey: next.publicKey,
            walletId: next.walletId ?? null,
            isEmbedded: next.isEmbedded,
            status: next.status ?? null,
            walletName: next.walletName ?? null,
          }
        : null,
    )
  }, [])

  useEffect(() => {
    if (hasRestored) return
    setHasRestored(true)

    const stored = loadStoredWallet()
    if (!stored) return

    if (stored.provider === 'stellar-wallets-kit') {
      const restoreExternal = async () => {
        try {
          const { address } = await stellarWalletKit.getAddress({
            skipRequestAccess: true,
          })
          if (address) {
            persistWallet({
              provider: 'stellar-wallets-kit',
              publicKey: address,
              isEmbedded: false,
              status: 'active',
              walletName: stored.walletName ?? 'Freighter',
            })
          }
        } catch {
          persistWallet(null)
        }
      }
      void restoreExternal()
      return
    }

    if (pollar.isAuthenticated && pollar.walletAddress) {
      persistWallet({
        provider: 'pollar',
        publicKey: pollar.walletAddress,
        walletId: getEmbeddedWalletId(pollar.session) ?? undefined,
        isEmbedded: true,
        status: getEmbeddedWalletStatus(pollar.session),
        walletName: 'Pollar',
      })
    }
  }, [hasRestored, persistWallet, pollar.isAuthenticated, pollar.session, pollar.walletAddress])

  useEffect(() => {
    if (!pollar.isAuthenticated || !pollar.walletAddress) {
      if (wallet?.provider === 'pollar' && !pollar.isAuthenticated) {
        persistWallet(null)
      }
      return
    }

    persistWallet({
      provider: 'pollar',
      publicKey: pollar.walletAddress,
      walletId: getEmbeddedWalletId(pollar.session) ?? undefined,
      isEmbedded: true,
      status: getEmbeddedWalletStatus(pollar.session),
      walletName: 'Pollar',
    })

    setTxHistory(pollar.txHistory)

    if (pollar.walletBalance.step === 'loaded') {
      const records = pollar.walletBalance.data.balances as Array<Record<string, unknown>>
      setBalances({
        xlm:
          pollar.walletBalance.data.balances.find((record) => {
            const value = record as any
            const asset = String(value.asset ?? value.asset_code ?? '').toUpperCase()
            return asset === 'XLM'
          })?.balance ?? null,
        usdc:
          pollar.walletBalance.data.balances.find((record) => {
            const value = record as any
            const asset = String(value.asset ?? value.asset_code ?? '').toUpperCase()
            return asset === 'USDC'
          })?.balance ?? null,
        records,
        source: 'pollar',
        updatedAt: new Date().toISOString(),
      })
    }
  }, [
    pollar.isAuthenticated,
    pollar.walletAddress,
    pollar.session,
    pollar.txHistory,
    pollar.walletBalance,
    persistWallet,
    wallet?.provider,
  ])

  useEffect(() => {
    if (!wallet || wallet.provider !== 'stellar-wallets-kit') return
    let cancelled = false

    const refresh = async () => {
      try {
        const nextBalances = await fetchHorizonBalances(wallet.publicKey)
        if (!cancelled) setBalances(nextBalances)
      } catch (error) {
        if (!cancelled) {
          console.error('[wallet-provider] failed to load wallet balances', error)
        }
      }
    }

    void refresh()
    return () => {
      cancelled = true
    }
  }, [wallet?.publicKey, wallet?.provider])

  useEffect(() => {
    let cancelled = false

    const syncProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !wallet) return

      const email = user.email?.trim()
      if (!email) {
        if (!cancelled) {
          console.warn('[wallet-provider] skip profile sync: auth user has no email')
        }
        return
      }

      const metaType = user.user_metadata?.user_type
      const user_type =
        metaType === 'pyme' ||
        metaType === 'investor' ||
        metaType === 'supplier' ||
        metaType === 'admin'
          ? metaType
          : 'pyme'

      const baseRow = {
        wallet_provider: wallet.provider,
        pollar_wallet_id: wallet.walletId ?? null,
        stellar_public_key: wallet.publicKey,
        wallet_status: wallet.status ?? null,
        updated_at: new Date().toISOString(),
      }

      const { data: existing, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!cancelled && selectError) {
        console.error('[wallet-provider] failed to read profile for wallet sync', selectError)
        return
      }

      if (existing) {
        const { error } = await supabase.from('profiles').update(baseRow).eq('id', user.id)
        if (!cancelled && error) {
          console.error('[wallet-provider] failed to sync wallet metadata', error)
        }
        return
      }

      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        email,
        user_type,
        ...baseRow,
      })

      if (insertError?.code === '23505') {
        const { error: retryError } = await supabase.from('profiles').update(baseRow).eq('id', user.id)
        if (!cancelled && retryError) {
          console.error('[wallet-provider] failed to sync wallet metadata', retryError)
        }
        return
      }

      if (!cancelled && insertError) {
        console.error('[wallet-provider] failed to sync wallet metadata', insertError)
      }
    }

    void syncProfile()

    return () => {
      cancelled = true
    }
  }, [supabase, wallet])

  useEffect(() => {
    if (!pollar.isAuthenticated || !pollar.session || !pollar.walletAddress) return

    const accessToken = pollar.session.token?.accessToken
    if (!accessToken) return

    if (pollarSupabaseSyncCompletedRef.current === accessToken) return
    if (pollarSupabaseSyncInFlightRef.current === accessToken) return

    let cancelled = false
    pollarSupabaseSyncInFlightRef.current = accessToken

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (cancelled) return

        if (user) {
          pollarSupabaseSyncCompletedRef.current = accessToken
          return
        }

        const session = pollar.session!
        const mail = session.data?.mail?.trim() ?? ''
        const uid = session.userId ?? session.clientSessionId ?? ''
        const firstName = session.data?.first_name?.trim() ?? ''
        const lastName = session.data?.last_name?.trim() ?? ''

        const res = await fetch('/api/auth/pollar-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken,
            stellarPublicKey: pollar.walletAddress,
            email: mail || undefined,
            pollarUserId: uid || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
          }),
        })

        const payload = (await res.json().catch(() => ({}))) as {
          error?: string
          token_hash?: string
        }

        if (cancelled) return

        if (!res.ok) {
          throw new Error(payload.error || 'Could not link Pollar to your Mercato account')
        }

        const tokenHash = payload.token_hash
        if (!tokenHash) {
          throw new Error('Sign-in response was incomplete')
        }

        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink',
        })

        if (cancelled) return

        if (otpError) throw otpError

        pollarSupabaseSyncCompletedRef.current = accessToken
        router.refresh()
        if (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/sign-up')) {
          router.push('/dashboard')
        }
      } catch (error) {
        pollarSupabaseSyncCompletedRef.current = null
        console.error('[wallet-provider] Pollar ↔ Supabase sync failed', error)
        toast.error(error instanceof Error ? error.message : 'Sign-in failed')
      } finally {
        pollarSupabaseSyncInFlightRef.current = null
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    pathname,
    pollar.isAuthenticated,
    pollar.session,
    pollar.walletAddress,
    router,
    supabase,
  ])

  const connectExternalWallet = useCallback(async () => {
    if (!stellarWalletKit) return

    await stellarWalletKit.openModal({
      modalTitle: 'Connect Your Stellar Wallet',
      onWalletSelected: async (option: ISupportedWallet) => {
        stellarWalletKit.setWallet(option.id)
        const { address } = await stellarWalletKit.getAddress()
        persistWallet({
          provider: 'stellar-wallets-kit',
          publicKey: address,
          isEmbedded: false,
          status: 'active',
          walletName: option.name,
        })
      },
    })
  }, [persistWallet])

  const connectPollarWallet = useCallback(async () => {
    const tryOpen = () => {
      const latest = pollarRef.current
      if (latest.isAuthenticated) {
        return
      }
      latest.openLoginModal()
    }

    const latest = pollarRef.current
    if (latest.isAuthenticated) {
      return
    }

    if (latest.isPollarEmbedReady) {
      tryOpen()
      return
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          tryOpen()
          resolve()
        })
      })
    })
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await stellarWalletKit?.disconnect()
    } catch {
      // ignore wallet-kit disconnect failures
    }

    try {
      await pollar.logout()
    } catch {
      // ignore embedded wallet logout failures
    }

    if (wallet?.provider === 'pollar') {
      try {
        await supabase.auth.signOut()
      } catch {
        // ignore sign-out failures
      }
    }

    pollarSupabaseSyncCompletedRef.current = null
    pollarSupabaseSyncInFlightRef.current = null

    persistWallet(null)
    setBalances(null)
    setTxHistory(null)
  }, [persistWallet, pollar, supabase, wallet?.provider])

  const refreshBalance = useCallback(async () => {
    if (!wallet) return

    if (wallet.provider === 'pollar') {
      await pollar.refreshWalletBalance()
      return
    }

    try {
      const nextBalances = await fetchHorizonBalances(wallet.publicKey)
      setBalances(nextBalances)
    } catch (error) {
      console.error('[wallet-provider] failed to refresh wallet balances', error)
    }
  }, [pollar, wallet])

  const value = useMemo<WalletContextValue>(
    () => ({
      provider: wallet?.provider ?? null,
      publicKey: wallet?.publicKey ?? null,
      walletId: wallet?.walletId ?? null,
      status: wallet?.status ?? null,
      isConnected: wallet !== null,
      isEmbedded: wallet?.isEmbedded ?? false,
      walletName: wallet?.walletName ?? null,
      wallet,
      walletInfo: toWalletInfo(wallet),
      truncatedAddress: truncatePublicKey(wallet?.publicKey),
      balances,
      txHistory: txHistory ?? null,
      canSignTransactions: wallet?.provider === 'stellar-wallets-kit',
      connectExternalWallet,
      connectPollarWallet,
      disconnect,
      refreshBalance,
    }),
    [
      balances,
      connectExternalWallet,
      connectPollarWallet,
      disconnect,
      refreshBalance,
      txHistory,
      wallet,
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
