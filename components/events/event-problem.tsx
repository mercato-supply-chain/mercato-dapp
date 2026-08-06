'use client'

import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'

export function EventProblem() {
  const { t } = useI18n()
  const { ref, visible } = useReveal(0.12)

  return (
    <section className="border-b border-border/50 py-16 md:py-20">
      <div
        ref={ref}
        className={cn(
          'container mx-auto max-w-4xl px-4 transition-all duration-700',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid">
          {t('events.sections.problemEyebrow')}
        </p>
        <h2 className="font-display mb-6 text-3xl font-normal tracking-tight md:text-4xl">
          {t('events.sections.problemTitle')}
        </h2>
        <p className="mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          {t('events.sections.problemBody')}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <p className="font-display text-4xl text-brand-mid">{t('events.sections.problemStat1')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('events.sections.problemStat1Label')}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <p className="font-display text-4xl text-brand-mid">{t('events.sections.problemStat2')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('events.sections.problemStat2Label')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
