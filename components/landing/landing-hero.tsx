'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'
import { LANDING_SECTION_IDS } from '@/lib/navigation/landing-nav'

export function LandingHero({ orderPreview }: { orderPreview: ReactNode }) {
  const { t } = useI18n()

  return (
    <section aria-labelledby="landing-hero-title" className="bg-landing-hero">
      <div className="mx-auto grid max-w-7xl gap-9 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-12 lg:py-16">
        <div className="min-w-0">
          <h1
            id="landing-hero-title"
            className="max-w-[17ch] text-balance font-display text-[clamp(2.75rem,5.55vw,5rem)] font-normal leading-[0.98] tracking-[-0.05em]"
          >
            {`${t('landing.hero.titleLine1')} ${t('landing.hero.titleLine2')}`}
          </h1>
          <p className="mt-5 max-w-[42ch] text-pretty text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            {t('landing.hero.description')}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 sm:mt-8">
            <Button
              asChild
              size="lg"
              className="h-auto min-h-12 max-w-full whitespace-normal rounded-lg bg-brand-dark px-5 py-2.5 text-left text-white hover:bg-brand-mid dark:bg-[#bde8c8] dark:text-[#13251a] dark:hover:bg-[#d4f2dc]"
            >
              <Link href="/deals">{t('landing.hero.primaryCta')}</Link>
            </Button>
            <a
              href={`#${LANDING_SECTION_IDS.howItWorks}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {t('landing.hero.flowLink')}
              <ArrowDown className="size-4 shrink-0" aria-hidden />
            </a>
          </div>
        </div>

        <div className="min-w-0">{orderPreview}</div>
      </div>
    </section>
  )
}
