'use client'

import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'
import { Package, TrendingUp, Zap } from 'lucide-react'

const AUDIENCES = [
  { key: 'audiencePyme', icon: Zap },
  { key: 'audienceInvestor', icon: TrendingUp },
  { key: 'audienceSupplier', icon: Package },
] as const

export function EventAudiences() {
  const { t } = useI18n()
  const { ref, visible } = useReveal(0.12)

  return (
    <section className="border-b border-border/50 bg-muted/20 py-16 md:py-20">
      <div
        ref={ref}
        className={cn(
          'container mx-auto max-w-4xl px-4 transition-all duration-700',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid">
          {t('events.sections.audiencesEyebrow')}
        </p>
        <h2 className="font-display mb-10 text-3xl font-normal tracking-tight md:text-4xl">
          {t('events.sections.audiencesTitle')}
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          {AUDIENCES.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-2xl border border-border/70 bg-card p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-mid/10 text-brand-mid">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mb-2 font-semibold">{t(`events.sections.${key}Title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`events.sections.${key}Body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
