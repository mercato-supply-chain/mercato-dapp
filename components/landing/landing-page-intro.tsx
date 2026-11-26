'use client'

import { useI18n } from '@/lib/i18n/provider'
import { ScrollReveal } from '@/components/landing/scroll-reveal'
import { cn } from '@/lib/utils'
import Image from 'next/image'

type LandingPartnersStripProps = {
  variant?: 'section' | 'hero'
}

export function LandingPartnersStrip({ variant = 'section' }: LandingPartnersStripProps) {
  const { t } = useI18n()
  const isHero = variant === 'hero'

  const content = (
    <div className={cn('mx-auto max-w-6xl', isHero && 'px-4')}>
      <p
        className={cn(
          'text-center text-sm font-medium',
          isHero ? 'mb-6 text-brand-mid/60 dark:text-white/40' : 'mb-8 text-brand-mid/60',
        )}
      >
        {t('landing.page.partnersEyebrow')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
            <a
              href="https://trustlesswork.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group flex items-center gap-2.5 opacity-50 transition-all duration-300 hover:opacity-100 hover:scale-105',
                isHero && 'hover:opacity-90',
              )}
            >
              <Image
                src="/trustless-work-logo.png"
                alt=""
                width={28}
                height={28}
                loading={isHero ? undefined : 'lazy'}
                className={cn('h-7 w-auto object-contain', isHero && 'dark:brightness-0 dark:invert')}
              />
              <span className={cn('text-sm font-semibold', isHero ? 'text-foreground/70 group-hover:text-foreground dark:text-white/60 dark:group-hover:text-white' : 'text-foreground/70 group-hover:text-foreground')}>Trustless Work</span>
            </a>
            <a
              href="https://etherfuse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-50 transition-all duration-300 hover:opacity-100 hover:scale-105"
            >
              <Image
                src="/etherfuse-logo.svg"
                alt="Etherfuse"
                width={96}
                height={24}
                loading={isHero ? undefined : 'lazy'}
                className="h-6 w-auto object-contain dark:invert"
              />
            </a>
            <a
              href="https://defindex.io"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-50 transition-all duration-300 hover:opacity-100 hover:scale-105"
            >
              <span className="flex items-center rounded-lg bg-brand-dark px-3 py-1.5 dark:bg-transparent dark:px-0 dark:py-0">
                <Image
                  src="/defindex-logo.svg"
                  alt="DeFindex"
                  width={112}
                  height={28}
                  loading={isHero ? undefined : 'lazy'}
                  className="h-7 w-auto object-contain"
                />
              </span>
            </a>
          </div>
    </div>
  )

  if (isHero) {
    return (
      <div
        id="built-with"
        className="landing-section-anchor py-8 md:py-10"
      >
        {content}
      </div>
    )
  }

  return (
    <ScrollReveal
      as="section"
      id="built-with"
      className="landing-section-anchor border-t border-border/40 bg-brand-ultra/50 py-12 dark:bg-muted/10"
      delay={100}
    >
      <div className="container mx-auto px-4">{content}</div>
    </ScrollReveal>
  )
}
