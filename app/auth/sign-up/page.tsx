'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MercatoLogo } from '@/components/mercato-logo'
import { useI18n } from '@/lib/i18n/provider'
import { useWallet } from '@/hooks/use-wallet'
import type { ReferralSupplier } from '@/app/api/referral/route'

function SignUpContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref')

  const [referral, setReferral] = useState<ReferralSupplier | null>(null)
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
            ...(referral ? { referred_by_supplier_id: referral.id } : {}),
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
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/30">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-[520px]">
          <Link
            href="/"
            className="mb-10 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-mid">
              <MercatoLogo onBrand className="h-5" />
            </span>
            <span>MERCATO</span>
          </Link>

          <Card className="border-border/80 shadow-lg shadow-black/5">
            <CardHeader className="space-y-1 pb-6 text-center sm:text-left">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {t('auth.signUpTitle')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('auth.signUpDescription')}
              </CardDescription>
              {referral && (
                <p className="mt-1 inline-flex w-fit rounded-full border border-brand-light/40 bg-brand-ultra px-3 py-1 text-xs font-medium text-brand-mid dark:bg-brand-dark/30">
                  {t('referral.onboarding.referredBy')}: {referral.company_name}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      placeholder="John Doe"
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
                      placeholder="Acme Inc."
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
                      placeholder={t('auth.repeatPassword')}
                      required
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                {error && (
                  <div
                    className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                    role="alert"
                    aria-live="polite"
                  >
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full font-medium"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t('auth.hasAccount')}{' '}
                <Link
                  href="/auth/login"
                  className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                >
                  {t('auth.logIn')}
                </Link>
              </p>
              </CardContent>
            </Card>

            <Card className="mt-6 border-dashed">
              <CardContent className="flex flex-col gap-3 pt-6">
                <div>
                  <p className="text-sm font-medium">{t('auth.continueWithPollar')}</p>
                  <p className="text-sm text-muted-foreground">{t('auth.pollarSignUpHint')}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={connectExternalWallet} className="sm:flex-1">
                    Connect Stellar Wallet
                  </Button>
                  <Button type="button" variant="secondary" onClick={connectPollarWallet} className="sm:flex-1">
                    {t('auth.continueWithPollar')}
                  </Button>
                </div>
              </CardContent>
            </Card>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t('auth.tagline')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  )
}
