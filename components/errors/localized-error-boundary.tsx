'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'

/**
 * Boundary ownership & Next.js App Router semantics:
 *
 * 1. Scope: Catches unhandled runtime exceptions during Server Component rendering,
 *    Client Component rendering, and effect initialization within its subtree.
 * 2. Navigation & Redirects: Framework-level control flow exceptions like `redirect()`
 *    (NEXT_REDIRECT) and `notFound()` (NEXT_NOT_FOUND) are re-thrown by Next.js and handled
 *    by the framework above the error boundary. They will NOT trigger this recovery UI.
 * 3. Event handlers: Exceptions inside client-side event handlers (`onClick`, `onSubmit`)
 *    do not occur during React render and are NOT caught by React error boundaries;
 *    event handlers must implement localized try/catch and user-facing notifications (e.g. toast).
 * 4. Diagnostics & Security: Safe diagnostic reference IDs (`error.digest`) are displayed
 *    without exposing raw exception messages, database queries, or sensitive state.
 */
export interface LocalizedErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  description?: string
  actionLabel?: string
  className?: string
  variant?: 'card' | 'page'
}

function useSafeI18n() {
  try {
    return useI18n()
  } catch {
    return null
  }
}

export function LocalizedErrorBoundary({
  error,
  reset,
  title,
  description,
  actionLabel,
  className = '',
  variant = 'card',
}: LocalizedErrorBoundaryProps) {
  const i18n = useSafeI18n()

  const defaultTitle = i18n?.t('errorBoundary.title') ?? 'Something went wrong'
  const defaultDescription =
    i18n?.t('errorBoundary.description') ??
    'An unexpected error occurred while loading this section.'
  const defaultAction = i18n?.t('errorBoundary.retry') ?? 'Try again'
  const diagnosticLabel = i18n?.t('errorBoundary.diagnosticLabel') ?? 'Error reference'

  const resolvedTitle = title ?? defaultTitle
  const resolvedDescription = description ?? defaultDescription
  const resolvedAction = actionLabel ?? defaultAction

  const isPage = variant === 'page'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={
        isPage
          ? `flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center ${className}`
          : `rounded-xl border border-border bg-card px-6 py-12 text-center ${className}`
      }
    >
      <AlertTriangle
        className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40"
        aria-hidden="true"
      />
      <h2 className="text-base font-semibold text-foreground tracking-tight sm:text-lg">
        {resolvedTitle}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {resolvedDescription}
      </p>

      {error.digest ? (
        <p className="mt-3 text-xs text-muted-foreground/60 font-mono select-all">
          {diagnosticLabel}: {error.digest}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" onClick={reset}>
          {resolvedAction}
        </Button>
      </div>
    </div>
  )
}
