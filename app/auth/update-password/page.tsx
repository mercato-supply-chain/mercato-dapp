'use client'

import type { FormEvent } from 'react'
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
import { useEffect, useState } from 'react'
import { MercatoLogo } from '@/components/mercato-logo'
import { useI18n } from '@/lib/i18n/provider'

export default function UpdatePasswordPage() {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && session)) {
        setHasSession(Boolean(session))
        setIsReady(true)
      }
    })

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(Boolean(session))
      setIsReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleUpdate = async (e: FormEvent) => {
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
      const { error } = await supabase.auth.updateUser({ password })
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
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/30">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-[400px]">
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
                {t('auth.updatePasswordTitle')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('auth.updatePasswordDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isReady ? (
                <p className="text-sm text-muted-foreground">{t('auth.checkingResetSession')}</p>
              ) : !hasSession ? (
                <div className="space-y-4">
                  <div
                    className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                    role="alert"
                  >
                    {t('auth.resetLinkInvalid')}
                  </div>
                  <Button asChild className="h-11 w-full font-medium" size="lg">
                    <Link href="/auth/forgot-password">{t('auth.requestNewResetLink')}</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleUpdate} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="password">{t('auth.newPassword')}</Label>
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
                    {isLoading ? t('auth.updatingPassword') : t('auth.updatePassword')}
                  </Button>
                </form>
              )}
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
