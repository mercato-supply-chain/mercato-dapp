'use client'

import { LocalizedErrorBoundary } from '@/components/errors/localized-error-boundary'
import { useI18n } from '@/lib/i18n/provider'
import { isDashboardDataError } from '@/lib/dashboard/get-dashboard-data'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  const description = isDashboardDataError(error)
    ? t('adminOverview.dataUnavailableHint')
    : t('adminOverview.errorHint')

  return (
    <LocalizedErrorBoundary
      error={error}
      reset={reset}
      title={t('adminOverview.errorTitle')}
      description={description}
      actionLabel={t('adminOverview.retry')}
    />
  )
}
