'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { usePollarSession } from '@/providers/pollar-provider'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function usePollarWallet() {
  const supabase = useMemo(() => createClient(), [])
  const pollar = usePollarSession()
  const pollarRef = useRef(pollar)
  pollarRef.current = pollar
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const pollarSupabaseSyncCompletedRef = useRef<string | null>(null)
  const pollarSupabaseSyncInFlightRef = useRef<string | null>(null)

  const connectPollarWallet = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY) {
      toast.error(t('auth.pollarUnavailable'))
      return
    }

    const deadline = Date.now() + 4000
    while (Date.now() < deadline) {
      const latest = pollarRef.current
      if (latest.isConfigured && latest.isPollarEmbedReady) {
        if (latest.isAuthenticated) return
        latest.openLoginModal()
        return
      }
      await wait(50)
    }

    toast.error(t('auth.pollarUnavailable'))
  }, [t])

  useEffect(() => {
    if (!pollar.isAuthenticated || !pollar.verified || !pollar.session || !pollar.walletAddress) return

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
        const profile = pollar.getClient().getUserProfile()
        const mail = profile?.mail?.trim() ?? ''
        const uid = session.userId ?? session.clientSessionId ?? ''
        const firstName = profile?.first_name?.trim() ?? ''
        const lastName = profile?.last_name?.trim() ?? ''

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

        const {
          data: { user: signedInUser },
        } = await supabase.auth.getUser()
        let destination = '/dashboard'
        if (signedInUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_type')
            .eq('id', signedInUser.id)
            .single()
          if (!profile?.user_type) {
            destination = '/settings?onboarding=1'
          }
        }

        router.refresh()
        if (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/sign-up')) {
          router.push(destination)
        } else if (destination.includes('onboarding=1') && !pathname.startsWith('/settings')) {
          router.push(destination)
        }
      } catch (error) {
        pollarSupabaseSyncCompletedRef.current = null
        console.error('[pollar-wallet] Pollar ↔ Supabase sync failed', error)
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
    pollar.verified,
    pollar.session,
    pollar.walletAddress,
    router,
    supabase,
  ])

  const clearPollarSyncRefs = useCallback(() => {
    pollarSupabaseSyncCompletedRef.current = null
    pollarSupabaseSyncInFlightRef.current = null
  }, [])

  return { connectPollarWallet, clearPollarSyncRefs }
}
