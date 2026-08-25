'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n()

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
      <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" aria-hidden />
      <p className="font-medium">{t('adminOverview.errorTitle')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('adminOverview.errorHint')}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
        {t('adminOverview.retry')}
      </Button>
    </div>
  )
}
