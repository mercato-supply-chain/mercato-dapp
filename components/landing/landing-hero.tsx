'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'
import { LANDING_SECTION_IDS } from '@/lib/navigation/landing-nav'

export function LandingHero() {
  const { t } = useI18n()

  return (
    <section aria-labelledby="landing-hero-title" className="border-b border-border bg-landing-hero">
      <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-9">
        <div className="grid overflow-hidden rounded-2xl bg-[#123525] text-[#F2FAF5] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.06fr)]">
          <div className="flex flex-col justify-center px-5 py-9 sm:px-10 sm:py-12 lg:px-9 xl:px-14 xl:py-16">
            <h1
              id="landing-hero-title"
              className="font-display text-[clamp(2.25rem,5.2vw,3.875rem)] font-normal leading-[1.04] tracking-tight lg:text-[clamp(2.75rem,4.2vw,3.875rem)]"
            >
              <span className="block text-balance">{t('landing.hero.titleLine1')}</span>{' '}
              <span className="block text-balance">{t('landing.hero.titleLine2')}</span>
            </h1>
            <p className="mt-5 max-w-[42ch] text-pretty text-base leading-relaxed text-[#D4E7DB] sm:text-lg">
              {t('landing.hero.description')}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6">
              <Button
                asChild
                className="h-11 rounded-full bg-[#C9EBCD] px-5 font-semibold text-[#123525] ring-offset-[#123525] hover:bg-[#E8F4EC] focus-visible:ring-[#C9EBCD]"
              >
                <Link href="/deals">{t('landing.hero.primaryCta')}</Link>
              </Button>
              <a
                href={`#${LANDING_SECTION_IDS.howItWorks}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9EBCD]"
              >
                {t('landing.hero.flowLink')}
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="relative aspect-[3/2] sm:aspect-[2/1] lg:aspect-auto lg:min-h-[28rem]">
            <Image
              src="/hero-photo.png"
              alt={t('landing.hero.photoAlt')}
              fill
              preload
              sizes="(min-width: 1536px) 775px, (min-width: 1280px) 640px, (min-width: 1024px) 510px, (min-width: 768px) 736px, (min-width: 640px) 608px, calc(100vw - 32px)"
              className="object-cover object-[65%_center] brightness-110"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
