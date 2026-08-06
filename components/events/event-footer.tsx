'use client'

import Link from 'next/link'
import { Linkedin } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

const SOCIAL_LINKS = {
  x: 'https://x.com/mercatoweb3',
  linkedin: 'https://www.linkedin.com/company/mercato-capital/',
} as const

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function EventFooter() {
  const { t } = useI18n()

  return (
    <footer className="border-t border-border/60 bg-muted/30 py-10">
      <div className="container mx-auto flex flex-col items-center gap-3 px-4 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">MERCATO</p>
        <div className="flex items-center justify-center gap-3">
          <a
            href={SOCIAL_LINKS.x}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-brand-mid/30 hover:text-foreground"
            aria-label={t('events.common.footerX')}
          >
            <XIcon className="h-4 w-4" />
          </a>
          <a
            href={SOCIAL_LINKS.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-brand-mid/30 hover:text-foreground"
            aria-label={t('events.common.footerLinkedIn')}
          >
            <Linkedin className="h-4 w-4" aria-hidden />
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="https://mercatocapital.xyz" className="underline-offset-4 hover:underline">
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
