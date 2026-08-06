'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'
import { ArrowDown, BadgeCheck, Eye } from 'lucide-react'
import type { EventConfig } from '@/lib/events/config'

type EventHeroProps = {
  event: EventConfig
}

function getEventNamespace(event: EventConfig) {
  if (event.slug === 'meetup-argentina') return 'events.meetupArgentina'
  return 'events.meetupArgentina'
}

export function EventHero({ event }: EventHeroProps) {
  const { t } = useI18n()
  const { ref, visible } = useReveal(0.15)
  const ns = getEventNamespace(event)

  const scrollToForm = () => {
    document.getElementById('event-discovery-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-brand-ultra/60 to-background py-16 md:py-24">
      <div
        className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-brand-light/30 blur-3xl"
        aria-hidden
      />
      <div
        ref={ref}
        className={cn(
          'container relative mx-auto max-w-3xl px-4 text-center transition-all duration-700',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-mid/20 bg-brand-pale/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-mid dark:text-brand-light">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          {t(`${ns}.badge`)}
        </p>

        <h1 className="font-display text-[clamp(2.25rem,6vw,3.75rem)] font-normal leading-[1.05] tracking-tight text-balance">
          <span className="block">{t(`${ns}.heroTitle`)}</span>
          <span className="mt-1 block text-brand-mid dark:text-brand-light">
            {t(`${ns}.heroTitleAccent`)}
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          {t(`${ns}.heroDescription`)}
        </p>

        <ul className="mt-8 flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-center sm:gap-6">
          <li className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-brand-mid" aria-hidden />
            {t(`${ns}.heroTrust1`)}
          </li>
          <li className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-brand-mid" aria-hidden />
            {t(`${ns}.heroTrust2`)}
          </li>
        </ul>

        <Button
          size="lg"
          className="mt-10 h-12 rounded-full px-8"
          onClick={scrollToForm}
          type="button"
        >
          {t('events.common.scrollToForm')}
          <ArrowDown className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </div>
    </section>
  )
}
