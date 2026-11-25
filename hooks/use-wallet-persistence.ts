'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStellarWalletKit } from '@/lib/trustless/lazy-wallet-kit'
import { usePollarSession } from '@/providers/pollar-provider'
import { useOptionalNavAuth } from '@/components/providers/nav-auth-provider'
import {
  getEmbeddedWalletId,
  getEmbeddedWalletStatus,
  loadStoredWallet,
  saveStoredWallet,
  type ConnectedWallet,
} from '@/lib/mercato-wallet'
import { resolveSignupUserType } from '@/lib/profile/onboarding'
import {
  clearPersistedWalletSessions,
  isPollarHydrationBlockedForUser,
  markPollarHydrationBlockedForUser,
  readStoredWalletOwnerId,
  registerActiveWalletSessionCleanup,
  writeStoredWalletOwnerId,
} from '@/lib/wallet/session-cleanup'

type ScopedManualWallet = {
  ownerId: string | null
  wallet: ConnectedWallet
}

export function useWalletPersistence() {
  const supabase = useMemo(() => createClient(), [])
  const pollar = usePollarSession()
  const navAuth = useOptionalNavAuth()
  const [manualEntry, setManualEntry] = useState<ScopedManualWallet | null>(null)
  const hasRestoredRef = useRef(false)
  const lastSyncedFingerprintRef = useRef<string | null>(null)

  const activeUserId = navAuth?.user?.id ?? null
  const activeUserIdRef = useRef<string | null>(activeUserId)
  useEffect(() => {
    activeUserIdRef.current = activeUserId
  }, [activeUserId])

  const storedOwnerId = typeof window !== 'undefined' ? readStoredWalletOwnerId() : null
  const hasOwnerMismatch = Boolean(
    storedOwnerId && activeUserId && storedOwnerId !== activeUserId,
  )
  const isPollarHydrationBlocked =
    hasOwnerMismatch ||
    Boolean(activeUserId && isPollarHydrationBlockedForUser(activeUserId))

  const manualWallet =
    manualEntry &&
    (!manualEntry.ownerId || !activeUserId || manualEntry.ownerId === activeUserId)
      ? manualEntry.wallet
      : null

  const {
    isAuthenticated: pollarIsAuthenticated,
    verified: pollarVerified,
    walletAddress: pollarWalletAddress,
    session: pollarSession,
    wallet: pollarWallet,
    logout: pollarLogout,
  } = pollar

  const clearStoredWalletBinding = useCallback(() => {
    lastSyncedFingerprintRef.current = null
    writeStoredWalletOwnerId(null)
    saveStoredWallet(null)
  }, [])

  const persistWallet = useCallback(
    (next: ConnectedWallet | null) => {
      if (!next) {
        setManualEntry(null)
        clearStoredWalletBinding()
        return
      }
      const currentOwnerId = activeUserIdRef.current
      setManualEntry({ ownerId: currentOwnerId, wallet: next })
      writeStoredWalletOwnerId(currentOwnerId)
      saveStoredWallet({
        provider: next.provider,
        publicKey: next.publicKey,
        walletId: next.walletId ?? null,
        isEmbedded: next.isEmbedded,
        status: next.status ?? null,
        walletName: next.walletName ?? null,
      })
    },
    [clearStoredWalletBinding],
  )

  useEffect(() => {
    return registerActiveWalletSessionCleanup(() => {
      lastSyncedFingerprintRef.current = null
      setManualEntry(null)
    })
  }, [])

  // Tear down external storage, pollar:* keys, IndexedDB pollar-keys, and Pollar SDK session
  // immediately when bound owner differs from active user — even if @pollar/react has not yet
  // finished async hydration on the first render.
  useEffect(() => {
    if (!hasOwnerMismatch) return
    markPollarHydrationBlockedForUser(activeUserId)
    clearStoredWalletBinding()
    void clearPersistedWalletSessions()
    if (pollarIsAuthenticated) {
      pollarLogout()
    }
  }, [activeUserId, clearStoredWalletBinding, hasOwnerMismatch, pollarIsAuthenticated, pollarLogout])

  // If @pollar/react asynchronously hydrates a prior account's session on a subsequent render
  // after an owner mismatch was detected for this user, revoke and wipe it immediately.
  useEffect(() => {
    if (!isPollarHydrationBlocked || !pollarIsAuthenticated) return
    pollarLogout()
    void clearPersistedWalletSessions()
  }, [isPollarHydrationBlocked, pollarIsAuthenticated, pollarLogout])

  useEffect(() => {
    if (hasRestoredRef.current) return
    hasRestoredRef.current = true

    const stored = loadStoredWallet()
    if (!stored || stored.provider !== 'stellar-wallets-kit') return

    const boundOwner = readStoredWalletOwnerId()
    if (boundOwner && activeUserId && boundOwner !== activeUserId) {
      markPollarHydrationBlockedForUser(activeUserId)
      clearStoredWalletBinding()
      void clearPersistedWalletSessions()
      return
    }

    const restoreExternal = async () => {
      try {
        if (boundOwner && !activeUserId) {
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user || user.id !== boundOwner) {
            persistWallet(null)
            return
          }
        }

        const walletKit = await getStellarWalletKit()
        if (!walletKit) {
          persistWallet(null)
          return
        }

        const { address } = await walletKit.getAddress({
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
  }, [activeUserId, clearStoredWalletBinding, persistWallet, supabase])

  const embeddedWalletId = getEmbeddedWalletId(pollarSession) ?? undefined
  const embeddedWalletStatus = getEmbeddedWalletStatus(pollarWallet)

  const derivedPollarWallet = useMemo<ConnectedWallet | null>(() => {
    if (
      isPollarHydrationBlocked ||
      !pollarIsAuthenticated ||
      !pollarVerified ||
      !pollarWalletAddress
    ) {
      return null
    }
    return {
      provider: 'pollar',
      publicKey: pollarWalletAddress,
      walletId: embeddedWalletId,
      isEmbedded: true,
      status: embeddedWalletStatus,
      walletName: 'Pollar',
    }
  }, [
    embeddedWalletId,
    embeddedWalletStatus,
    isPollarHydrationBlocked,
    pollarIsAuthenticated,
    pollarVerified,
    pollarWalletAddress,
  ])

  // Prefer an explicitly connected external wallet; otherwise reflect verified Pollar session.
  const wallet = hasOwnerMismatch
    ? null
    : manualWallet?.provider === 'stellar-wallets-kit'
      ? manualWallet
      : derivedPollarWallet ?? manualWallet

  // Mirror verified Pollar wallet state to localStorage without triggering cascading setState.
  useEffect(() => {
    if (isPollarHydrationBlocked || manualWallet?.provider === 'stellar-wallets-kit') return
    if (derivedPollarWallet) {
      saveStoredWallet({
        provider: derivedPollarWallet.provider,
        publicKey: derivedPollarWallet.publicKey,
        walletId: derivedPollarWallet.walletId ?? null,
        isEmbedded: derivedPollarWallet.isEmbedded,
        status: derivedPollarWallet.status ?? null,
        walletName: derivedPollarWallet.walletName ?? null,
      })
      return
    }
    if (!pollarIsAuthenticated) {
      const stored = loadStoredWallet()
      if (stored?.provider === 'pollar') {
        saveStoredWallet(null)
        writeStoredWalletOwnerId(null)
      }
    }
  }, [
    derivedPollarWallet,
    isPollarHydrationBlocked,
    manualWallet?.provider,
    pollarIsAuthenticated,
  ])

  useEffect(() => {
    if (!wallet) return
    let cancelled = false

    const syncProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (cancelled || !user) return
      if (activeUserIdRef.current && activeUserIdRef.current !== user.id) return

      const boundOwnerId = readStoredWalletOwnerId()
      const pollarBlockedForUser =
        wallet.provider === 'pollar' &&
        (isPollarHydrationBlocked || isPollarHydrationBlockedForUser(user.id))

      if (pollarBlockedForUser || (boundOwnerId && boundOwnerId !== user.id)) {
        markPollarHydrationBlockedForUser(user.id)
        const wasPollar = wallet.provider === 'pollar'
        persistWallet(null)
        if (wasPollar || pollarIsAuthenticated) {
          pollarLogout()
        }
        void clearPersistedWalletSessions()
        return
      }

      if (wallet.provider === 'pollar' && (!pollarIsAuthenticated || !pollarVerified)) {
        return
      }

      const fingerprint = `${user.id}:${wallet.provider}:${wallet.publicKey}:${wallet.walletId ?? ''}:${wallet.status ?? ''}`
      if (lastSyncedFingerprintRef.current === fingerprint) {
        writeStoredWalletOwnerId(user.id)
        return
      }

      writeStoredWalletOwnerId(user.id)

      const email = user.email?.trim()
      if (!email) {
        if (!cancelled) {
          console.warn('[wallet-persistence] skip profile sync: auth user has no email')
        }
        return
      }

      const user_type = resolveSignupUserType(user.user_metadata?.user_type)

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
        console.error('[wallet-persistence] failed to read profile', selectError)
        return
      }

      if (existing) {
        const { error } = await supabase.from('profiles').update(baseRow).eq('id', user.id)
        if (!cancelled && error) {
          console.error('[wallet-persistence] failed to sync wallet metadata', error)
          return
        }
        if (!cancelled) {
          lastSyncedFingerprintRef.current = fingerprint
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
          console.error('[wallet-persistence] failed to sync wallet metadata', retryError)
          return
        }
        if (!cancelled) {
          lastSyncedFingerprintRef.current = fingerprint
        }
        return
      }

      if (!cancelled && insertError) {
        console.error('[wallet-persistence] failed to sync wallet metadata', insertError)
        return
      }

      if (!cancelled) {
        lastSyncedFingerprintRef.current = fingerprint
      }
    }

    void syncProfile()

    return () => {
      cancelled = true
    }
  }, [
    activeUserId,
    isPollarHydrationBlocked,
    persistWallet,
    pollarIsAuthenticated,
    pollarLogout,
    pollarVerified,
    supabase,
    wallet,
  ])

  return { wallet, persistWallet }
}
