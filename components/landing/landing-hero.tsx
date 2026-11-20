'use client'

import Link from 'next/link'
import { HeroDealSheet } from '@/components/landing/hero-deal-sheet'
import { HeroHowItWorksSteps } from '@/components/landing/hero-how-it-works-steps'
import { HeroStatsBar } from '@/components/landing/hero-stats-bar'
import { Button } from '@/components/ui/button'
import type { LandingHeroDeal } from '@/lib/landing/hero-deal'
import type { LandingPlatformStats } from '@/lib/landing/platform-stats'
import { useI18n } from '@/lib/i18n/provider'
import { BadgeCheck } from 'lucide-react'

type LandingHeroProps = {
  deal: LandingHeroDeal
  stats: LandingPlatformStats
}

export function LandingHero({ deal, stats }: LandingHeroProps) {
  const { t } = useI18n()

  return (
    <section className="hero-ref relative overflow-x-clip bg-landing-hero text-foreground transition-colors duration-500 dark:bg-[hsl(0_0%_4%)]">
      <div className="relative isolate overflow-hidden">
        <div className="hero-glow absolute -left-24 top-10 h-[26rem] w-[26rem] rounded-full bg-brand-mid/15 opacity-25 blur-[90px]" aria-hidden />

        <div className="container relative z-10 mx-auto grid items-center gap-7 px-4 pb-12 pt-[5.5rem] md:gap-10 md:pb-16 md:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-14 lg:pb-20 xl:gap-20">
          <div className="max-w-2xl text-left">
            <div className="hero-stagger-1 mb-4 flex items-center gap-2 md:mb-5">
              <BadgeCheck className="h-5 w-5 text-brand-mid dark:text-brand-light" aria-hidden />
              <span className="text-sm font-semibold text-brand-mid dark:text-brand-light">
                {t('landing.hero.badge')}
              </span>
            </div>

            <h1 className="hero-stagger-2 font-display text-[clamp(2.25rem,5.5vw,4rem)] font-normal leading-[1.05] tracking-tight text-balance">
              <span className="block">{t('landing.hero.titleLine1')}</span>
              <span className="mt-1 block text-brand-mid dark:text-brand-light">
                {t('landing.hero.titleLine2')}
              </span>
            </h1>

            <p className="hero-stagger-3 sr-only max-w-md text-base leading-relaxed text-muted-foreground sm:not-sr-only sm:mt-4 md:mt-6 md:text-lg">
              {t('landing.hero.description')}
            </p>

            <div className="hero-stagger-3 mt-7 hidden sm:block">
              <Button asChild variant="outline">
                <Link href="/deals">{t('landing.hero.primaryCta')}</Link>
              </Button>
            </div>
          </div>

          <HeroDealSheet deal={deal} className="hero-stagger-4 w-full lg:justify-self-end" />
        </div>
      </div>

      <div className="relative z-20 w-full">
        <div className="hero-ref-bases-bar hero-stats-bar relative border-y border-border/60 bg-white dark:border-white/[0.08] dark:bg-[hsl(0_0%_4%/0.94)] dark:backdrop-blur-md">
          <div className="hero-ref-bases-inner relative z-[1] mx-auto py-3 md:py-4">
            <HeroStatsBar stats={stats} />
          </div>
        </div>
      </div>

      <div
        id="how-it-works"
        className="hero-ref-bases-steps landing-section-anchor relative z-10 w-full bg-background pb-8 pt-0 md:pb-10 dark:bg-[hsl(0_0%_4%)]"
      >
        <HeroHowItWorksSteps />
      </div>
    </section>
  )
}
