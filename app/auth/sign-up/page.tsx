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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Package, TrendingUp, Users } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userType, setUserType] = useState<'pyme' | 'investor' | 'supplier'>('pyme')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
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
            user_type: userType,
          },
        },
      })
      if (error) throw error
      router.push('/auth/sign-up-success')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Package className="h-5 w-5" aria-hidden />
            </span>
            <span>MERCATO</span>
          </Link>

          <Card className="border-border/80 shadow-lg shadow-black/5">
            <CardHeader className="space-y-1 pb-6 text-center sm:text-left">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Create your account
              </CardTitle>
              <CardDescription className="text-base">
                Choose your role and fill in your details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">I am a…</Label>
                  <RadioGroup
                    value={userType}
                    onValueChange={(v) => setUserType(v as 'pyme' | 'investor' | 'supplier')}
                    className="grid grid-cols-3 gap-3"
                  >
                    <label
                      htmlFor="pyme"
                      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-colors ${
                        userType === 'pyme'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value="pyme" id="pyme" className="sr-only" />
                      <Package className="h-7 w-7 shrink-0" aria-hidden />
                      <span className="text-sm font-medium">PyME</span>
                      <span className="text-xs text-muted-foreground">Need capital</span>
                    </label>
                    <label
                      htmlFor="investor"
                      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-colors ${
                        userType === 'investor'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value="investor" id="investor" className="sr-only" />
                      <TrendingUp className="h-7 w-7 shrink-0" aria-hidden />
                      <span className="text-sm font-medium">Investor</span>
                      <span className="text-xs text-muted-foreground">Fund deals</span>
                    </label>
                    <label
                      htmlFor="supplier"
                      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-colors ${
                        userType === 'supplier'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value="supplier" id="supplier" className="sr-only" />
                      <Users className="h-7 w-7 shrink-0" aria-hidden />
                      <span className="text-sm font-medium">Supplier</span>
                      <span className="text-xs text-muted-foreground">Get paid early</span>
                    </label>
                  </RadioGroup>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
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
                    <Label htmlFor="companyName">Company name</Label>
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
                  <Label htmlFor="email">Email</Label>
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
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Min. 6 characters"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repeat-password">Confirm password</Label>
                    <Input
                      id="repeat-password"
                      name="repeatPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat password"
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
                  {isLoading ? 'Creating account…' : 'Create account'}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
                >
                  Log in
                </Link>
              </p>
            </CardContent>
          </Card>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Supply chain finance for PyMEs, investors, and suppliers
          </p>
        </div>
      </div>
    </div>
  )
}
