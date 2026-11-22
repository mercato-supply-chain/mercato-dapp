'use client'

import { useI18n } from '@/lib/i18n/provider'

export function SkipLinkView({ label }: { label: string }) {
  return (
    <a
      href="#main"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
    </a>
  )
}

export function SkipLink() {
  const { t } = useI18n()

  return <SkipLinkView label={t('nav.skipToContent')} />
}
