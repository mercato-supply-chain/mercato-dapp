'use client'

import { LocalizedErrorBoundary } from '@/components/errors/localized-error-boundary'
import { useI18n } from '@/lib/i18n/provider'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  // Surface query failures explicitly so the admin dashboard never shows
  // misleading zero/empty KPIs during an upstream error.
  if (process.env.NODE_ENV !== 'production') {
    console.error('[dashboard:admin] section error', error.digest ?? error.message)
  }

  return (
    <LocalizedErrorBoundary
      error={error}
      reset={reset}
      title={t('adminOverview.errorTitle')}
      description={t('adminOverview.errorHint')}
      actionLabel={t('adminOverview.retry')}
    />
  )
}

