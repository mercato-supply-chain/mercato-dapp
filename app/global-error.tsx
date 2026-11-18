'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-center text-foreground font-sans antialiased">
        <div
          role="alert"
          aria-live="assertive"
          className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 shadow-sm"
        >
          <AlertTriangle
            className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40"
            aria-hidden="true"
          />
          <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A critical application error occurred. Please try again.
          </p>

          {error.digest ? (
            <p className="mt-3 text-xs font-mono text-muted-foreground/60 select-all">
              Error reference: {error.digest}
            </p>
          ) : null}

          <div className="mt-6 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => reset()}>
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
