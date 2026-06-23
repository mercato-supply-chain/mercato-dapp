'use client'

import { HeroHowItWorksSteps } from '@/components/landing/hero-how-it-works-steps'
import { HeroStatsBar } from '@/components/landing/hero-stats-bar'
import type { LandingPlatformStats } from '@/lib/landing/platform-stats'
import { useI18n } from '@/lib/i18n/provider'
import { BadgeCheck, Eye, ShieldCheck } from 'lucide-react'

const TRUST_ITEMS = [
  { key: 'trust1', icon: ShieldCheck },
  { key: 'trust2', icon: Eye },
] as const

type LandingHeroProps = {
  stats: LandingPlatformStats
}

export function LandingHero({ stats }: LandingHeroProps) {
  const { t } = useI18n()

  return (
    <section className="hero-ref relative overflow-x-clip bg-landing-hero text-foreground dark:bg-[hsl(0_0%_4%)] dark:text-white transition-colors duration-500">
      <div className="relative isolate overflow-hidden bg-[hsl(0_0%_5%)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-photo.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[60%_center]"
          decoding="async"
          fetchPriority="high"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/35 to-black/5" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" aria-hidden />
        <div className="hero-glow absolute -left-24 top-10 h-[26rem] w-[26rem] rounded-full bg-brand-mid/15 opacity-25 blur-[90px]" aria-hidden />

        <div className="container relative z-10 mx-auto flex min-h-[38rem] items-center px-4 pb-16 pt-16 md:min-h-[40rem] md:pb-20 lg:min-h-[42rem] lg:pb-24 lg:pt-20">
          <div className="max-w-xl text-left text-white">
            <div className="hero-stagger-1 mb-6 flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-brand-light animate-pulse" aria-hidden />
              <span className="text-[12px] font-bold uppercase tracking-[0.25em] text-brand-light">
                {t('landing.hero.badge')}
              </span>
            </div>

            <h1 className="hero-stagger-2 font-display text-[clamp(2.75rem,6.5vw,4.5rem)] font-normal leading-[1.04] tracking-tight text-balance">
              <span className="block text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
                {t('landing.hero.titleLine1')}
              </span>
              <span className="mt-1 block text-brand-light drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
                {t('landing.hero.titleLine2')}
              </span>
            </h1>

            <p className="hero-stagger-3 mt-7 max-w-md text-base leading-relaxed text-white/80 md:text-lg">
              {t('landing.hero.description')}
            </p>

            <ul className="hero-stagger-4 mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
                {TRUST_ITEMS.map(({ key, icon: Icon }) => (
                  <li
                    key={key}
                    className="flex items-center gap-2 text-[13px] font-medium text-white/65 transition-colors hover:text-white"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-brand-light/90" aria-hidden />
                    {t(`landing.hero.${key}`)}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="hero-ref-bases-band hero-stats-band relative z-20 w-full">
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
