'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/provider'
import { useWallet } from '@/hooks/use-wallet'
import { AuthSplitShell } from '@/components/auth/auth-split-shell'
import type { ReferralSupplier } from '@/app/api/referral/route'
import type { ResolvedInvite } from '@/app/api/referral/invite/route'

export function SignUpForm({
  refCode,
  inviteToken,
}: {
  refCode: string | null
  inviteToken: string | null
}) {
  const { t } = useI18n()
  const [referral, setReferral] = useState<ReferralSupplier | null>(null)
  const [invite, setInvite] = useState<ResolvedInvite | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { connectPollarWallet, connectExternalWallet } = useWallet()

  useEffect(() => {
    if (!refCode) return
    fetch(`/api/referral?code=${encodeURIComponent(refCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReferralSupplier | null) => {
        if (data?.id) {
          setReferral(data)
          document.cookie = `mercato-referral=${data.id}; path=/; max-age=86400; samesite=lax`
        }
      })
      .catch(() => {})
  }, [refCode])

  useEffect(() => {
    if (!inviteToken) return
    fetch(`/api/referral/invite?token=${encodeURIComponent(inviteToken)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ResolvedInvite | null) => {
        if (data?.supplierCompanyId) {
          setInvite(data)
          setReferral({
            id: data.supplierCompanyId,
            company_name: data.companyName ?? 'Supplier',
          })
          document.cookie = `mercato-invite=${encodeURIComponent(inviteToken)}; path=/; max-age=86400; samesite=lax`
          document.cookie = `mercato-referral=${data.supplierCompanyId}; path=/; max-age=86400; samesite=lax`
        }
      })
      .catch(() => {})
  }, [inviteToken])

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError(t('auth.passwordMismatch'))
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'))
      setIsLoading(false)
      return
    }

    try {
      if (inviteToken) {
        void fetch('/api/referral/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteToken, event: 'signup_started' }),
        }).catch(() => {})
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            company_name: companyName,
            ...(invite
              ? {
                  referred_by_supplier_id: invite.supplierCompanyId,
                  referral_invitation_id: invite.invitationId,
                }
              : {}),
            ...(referral && !invite ? { referred_by_supplier_id: referral.id } : {}),
          },
        },
      })
      if (error) throw error
      router.push('/auth/sign-up-success')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t('auth.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthSplitShell asideTitle={t('auth.signUpAsideTitle')} asideBody={t('auth.signUpAsideBody')}>
      <h1 className="font-display text-4xl font-normal tracking-tight text-foreground">
        {t('auth.signUpTitle')}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {t('auth.signUpDescription')}
      </p>
      {referral ? (
        <p className="mt-4 text-sm leading-relaxed text-brand-mid">
          {t('referral.onboarding.referredByBanner', {
            company: referral.company_name ?? 'Supplier',
          })}
        </p>
      ) : null}

      <div className="mt-8 space-y-3">
        <Button
          type="button"
          className="h-12 w-full bg-brand-mid text-base font-medium text-white hover:bg-brand-dark"
          size="lg"
          onClick={() => connectPollarWallet()}
        >
          {t('auth.continueWithPollar')}
        </Button>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('auth.pollarSignUpHint')}</p>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full font-medium"
          onClick={() => connectExternalWallet()}
        >
          {t('wallet.connectStellarMenu')}
        </Button>
      </div>

      <details className="group mt-10 border-t border-border pt-6">
        <summary className="cursor-pointer list-none rounded-sm text-sm font-medium text-foreground marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          {t('auth.signUpEmailToggle')}
        </summary>

        <form onSubmit={handleSignUp} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('auth.fullName')}</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('auth.companyName')}</Label>
              <Input
                id="companyName"
                name="companyName"
                type="text"
                autoComplete="organization"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={t('auth.minPassword')}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repeat-password">{t('auth.confirmPassword')}</Label>
              <Input
                id="repeat-password"
                name="repeatPassword"
                type="password"
                autoComplete="new-password"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {error ? (
            <div
              className="border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            variant="outline"
            className="h-11 w-full font-medium"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
          </Button>
        </form>
      </details>

      <p className="mt-10 text-sm text-muted-foreground">
        {t('auth.hasAccount')}{' '}
        <Link
          href="/auth/login"
          className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
        >
          {t('auth.logIn')}
        </Link>
      </p>
    </AuthSplitShell>
  )
}
