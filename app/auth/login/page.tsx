'use client'

import type { FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n/provider'
import { useWallet } from '@/hooks/use-wallet'
import { AuthSplitShell } from '@/components/auth/auth-split-shell'

export default function LoginPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { connectPollarWallet } = useWallet()

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/dashboard')
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t('auth.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthSplitShell asideTitle={t('auth.loginAsideTitle')} asideBody={t('auth.loginAsideBody')}>
      <h1 className="font-display text-4xl font-normal tracking-tight text-foreground">
        {t('auth.loginTitle')}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {t('auth.loginDescription')}
      </p>

      <div className="mt-8 space-y-3">
        <Button
          type="button"
          className="h-12 w-full bg-brand-mid text-base font-medium text-white hover:bg-brand-dark"
          size="lg"
          onClick={() => connectPollarWallet()}
        >
          {t('auth.continueWithPollar')}
        </Button>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('auth.continueWithPollarShort')}
        </p>
      </div>

      <details className="group mt-10 border-t border-border pt-6">
        <summary className="cursor-pointer list-none rounded-sm text-sm font-medium text-foreground marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          {t('auth.loginEmailToggle')}
        </summary>

        <form onSubmit={handleLogin} className="mt-6 space-y-5">
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
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
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
            {isLoading ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>
      </details>

      <p className="mt-10 text-sm text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <Link
          href="/auth/sign-up"
          className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
        >
          {t('nav.signUp')}
        </Link>
      </p>
    </AuthSplitShell>
  )
}
