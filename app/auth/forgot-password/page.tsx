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
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { MercatoLogo } from '@/components/mercato-logo'
import { useI18n } from '@/lib/i18n/provider'
import { Mail } from 'lucide-react'

function ForgotPasswordForm() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'reset_link' ? t('auth.resetLinkInvalid') : null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      })
      if (error) throw error
      setEmailSent(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t('auth.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-border/80 shadow-lg shadow-black/5">
      {emailSent ? (
        <>
          <CardHeader className="space-y-1 pb-6 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <Mail className="h-7 w-7 text-success" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {t('auth.resetEmailSentTitle')}
            </CardTitle>
            <CardDescription className="text-base">
              {t('auth.resetEmailSentDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.resetEmailSentHint')}
            </p>
            <Button asChild className="h-11 w-full font-medium" size="lg">
              <Link href="/auth/login">{t('auth.backToLogin')}</Link>
            </Button>
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader className="space-y-1 pb-6 text-center sm:text-left">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {t('auth.forgotPasswordTitle')}
            </CardTitle>
            <CardDescription className="text-base">
              {t('auth.forgotPasswordDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-5">
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
                {isLoading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link
                href="/auth/login"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                {t('auth.backToLogin')}
              </Link>
            </p>
          </CardContent>
        </>
      )}
    </Card>
  )
}

export default function ForgotPasswordPage() {
  const { t } = useI18n()

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

          <Suspense
            fallback={
              <Card className="border-border/80 shadow-lg shadow-black/5">
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold tracking-tight">
                    {t('auth.forgotPasswordTitle')}
                  </CardTitle>
                </CardHeader>
              </Card>
            }
          >
            <ForgotPasswordForm />
          </Suspense>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t('auth.tagline')}
          </p>
        </div>
      </div>
    </div>
  )
}
