'use client'

import { LocalizedErrorBoundary } from '@/components/errors/localized-error-boundary'
import { useI18n } from '@/lib/i18n/provider'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  return (
    <LocalizedErrorBoundary
      error={error}
      reset={reset}
      title={t('errorBoundary.dashboardTitle')}
      description={t('errorBoundary.dashboardDescription')}
      actionLabel={t('errorBoundary.retry')}
    />
  )
}
