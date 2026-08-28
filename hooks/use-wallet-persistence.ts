'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { stellarWalletKit } from '@/lib/trustless/wallet-kit'
import { usePollarSession } from '@/providers/pollar-provider'
import {
  getEmbeddedWalletId,
  getEmbeddedWalletStatus,
  loadStoredWallet,
  saveStoredWallet,
  type ConnectedWallet,
} from '@/lib/mercato-wallet'
import { resolveSignupUserType } from '@/lib/profile/onboarding'

export function useWalletPersistence() {
  const supabase = useMemo(() => createClient(), [])
  const pollar = usePollarSession()
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null)
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
  }, [pollar.isAuthenticated, pollar.walletAddress, pollar.session, persistWallet, wallet?.provider])

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
        }
        return
      }

      if (!cancelled && insertError) {
        console.error('[wallet-persistence] failed to sync wallet metadata', insertError)
      }
    }

    void syncProfile()

    return () => {
      cancelled = true
    }
  }, [supabase, wallet])

  return { wallet, persistWallet }
}
