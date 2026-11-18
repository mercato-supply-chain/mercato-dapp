'use client'

import { LocalizedErrorBoundary } from '@/components/errors/localized-error-boundary'
import { useI18n } from '@/lib/i18n/provider'

export default function InvestorsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="container mx-auto px-4 py-8">
      <LocalizedErrorBoundary
        error={error}
        reset={reset}
        title={t('errorBoundary.directoryTitle')}
        description={t('errorBoundary.directoryDescription')}
        actionLabel={t('errorBoundary.retry')}
        variant="card"
      />
    </div>
  )
}
