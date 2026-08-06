'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/provider'

export function EventFooter() {
  const { t } = useI18n()

  return (
    <footer className="border-t border-border/60 bg-muted/30 py-10">
      <div className="container mx-auto flex flex-col items-center gap-3 px-4 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">MERCATO</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="underline-offset-4 hover:underline">
            {t('events.common.footerHome')}
          </Link>
          <Link href="/how-it-works" className="underline-offset-4 hover:underline">
            {t('events.common.footerHowItWorks')}
          </Link>
        </div>
      </div>
    </footer>
  )
}
