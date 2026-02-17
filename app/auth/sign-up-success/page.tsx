import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CheckCircle2, Mail, Package } from 'lucide-react'

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/30">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-10 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Package className="h-5 w-5" aria-hidden />
            </span>
            MERCATO
          </Link>

          <Card className="border-border/80 shadow-lg shadow-black/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>
              We&apos;ve sent you a confirmation link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Verify your email address</p>
                  <p className="text-sm text-muted-foreground">
                    Click the link in the email we sent you to complete your registration and access your MERCATO account.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-center text-sm text-muted-foreground">
              <p>Didn&apos;t receive the email? Check your spam folder.</p>
              <p>The link will expire in 24 hours.</p>
            </div>

            <Button asChild className="h-11 w-full font-medium">
              <Link href="/auth/login">Return to login</Link>
            </Button>
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
