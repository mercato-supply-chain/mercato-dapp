'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'

export function LandingHero() {
  const { t } = useI18n()

  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-end overflow-hidden text-white">
      <Image
        src="/hero-photo.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[50%_60%]"
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/50" aria-hidden />

      <div className="relative z-10 w-full">
        <div className="container mx-auto max-w-3xl px-4 pb-16 pt-20 md:pb-24 md:pt-28">
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.05] tracking-tight text-pretty">
            <span className="block">{t('landing.hero.titleLine1')}</span>
            <span className="mt-1 block">{t('landing.hero.titleLine2')}</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/85 md:text-lg">
            {t('landing.hero.description')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button
              asChild
              className="bg-white text-foreground hover:bg-white/90"
            >
              <Link href="/deals">{t('landing.hero.primaryCta')}</Link>
            </Button>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-white underline-offset-4 hover:underline"
            >
              {t('landing.hero.flowLink')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
