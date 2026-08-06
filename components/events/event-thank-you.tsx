'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'
import { CheckCircle2 } from 'lucide-react'

export function EventThankYou() {
  const { t } = useI18n()

  return (
    <div className="rounded-2xl border border-brand-mid/20 bg-brand-ultra/50 p-8 text-center dark:bg-brand-mid/5">
      <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-brand-mid" aria-hidden />
      <h3 className="font-display mb-3 text-2xl">{t('events.common.thankYouTitle')}</h3>
      <p className="mx-auto mb-8 max-w-md text-muted-foreground">{t('events.common.thankYouBody')}</p>
      <Button asChild variant="outline" className="rounded-full">
        <Link href="/how-it-works">{t('events.common.thankYouCta')}</Link>
      </Button>
    </div>
  )
}
