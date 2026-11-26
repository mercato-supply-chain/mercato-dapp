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
    <section aria-labelledby="landing-hero-title" className="border-b border-border bg-landing-hero">
      <div className="container mx-auto px-4 pb-6 pt-9 sm:pb-9 sm:pt-12 lg:pb-12 lg:pt-16">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
          <h1
            id="landing-hero-title"
            className="text-balance font-display text-[clamp(2.25rem,6vw,5.25rem)] font-normal leading-[1.02] tracking-[-0.045em]"
          >
            {t('landing.hero.titleLine1')}{' '}
            {t('landing.hero.titleLine2')}
          </h1>
          <div className="max-w-lg">
            <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('landing.hero.description')}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 sm:mt-5 sm:gap-x-6">
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/deals">{t('landing.hero.primaryCta')}</Link>
              </Button>
              <a
                href={`#${LANDING_SECTION_IDS.howItWorks}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {t('landing.hero.flowLink')}
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-7 sm:mt-9 lg:mt-12">
          {orderPreview}
        </div>
      </div>
    </section>
  )
}
