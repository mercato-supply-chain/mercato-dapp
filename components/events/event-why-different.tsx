'use client'

import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'
import { BadgeCheck, Building2, Landmark } from 'lucide-react'

const COLUMNS = [
  {
    id: 'bank',
    icon: Landmark,
    titleKey: 'events.sections.whyBank',
    points: ['whyBankPoint1', 'whyBankPoint2', 'whyBankPoint3'],
    muted: true,
  },
  {
    id: 'informal',
    icon: Building2,
    titleKey: 'events.sections.whyInformal',
    points: ['whyInformalPoint1', 'whyInformalPoint2', 'whyInformalPoint3'],
    muted: true,
  },
  {
    id: 'mercato',
    icon: BadgeCheck,
    titleKey: 'events.sections.whyMercato',
    points: ['whyMercatoPoint1', 'whyMercatoPoint2', 'whyMercatoPoint3'],
    muted: false,
  },
] as const

export function EventWhyDifferent() {
  const { t } = useI18n()
  const { ref, visible } = useReveal(0.12)

  return (
    <section className="border-b border-border/50 py-12 sm:py-16 md:py-20">
      <div
        ref={ref}
        className={cn(
          'container mx-auto max-w-5xl px-4 transition-all duration-700',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid">
          {t('events.sections.whyEyebrow')}
        </p>
        <h2 className="font-display mb-10 text-3xl font-normal tracking-tight md:text-4xl">
          {t('events.sections.whyTitle')}
        </h2>

        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {COLUMNS.map(({ id, icon: Icon, titleKey, points, muted }) => (
            <div
              key={id}
              className={cn(
                'rounded-2xl border p-6',
                muted
                  ? 'border-border/70 bg-card'
                  : 'border-brand-mid/30 bg-gradient-to-br from-brand-ultra to-brand-pale/40 shadow-sm dark:from-brand-mid/10 dark:to-background',
              )}
            >
              <div className="mb-4 flex items-center gap-2">
                <Icon className={cn('h-5 w-5', muted ? 'text-muted-foreground' : 'text-brand-mid')} aria-hidden />
                <h3 className="font-semibold">{t(titleKey)}</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {points.map((pointKey) => (
                  <li key={pointKey} className="flex gap-2">
                    <span className="text-brand-mid">·</span>
                    <span>{t(`events.sections.${pointKey}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
