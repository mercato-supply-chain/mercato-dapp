'use client'

import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'
import { FileCheck, Package, RefreshCw, Wallet } from 'lucide-react'

const STEPS = [
  { key: 'howStep1', icon: FileCheck },
  { key: 'howStep2', icon: Wallet },
  { key: 'howStep3', icon: Package },
  { key: 'howStep4', icon: RefreshCw },
] as const

export function EventHowItWorks() {
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
          {t('events.sections.howEyebrow')}
        </p>
        <h2 className="font-display mb-10 text-3xl font-normal tracking-tight md:text-4xl">
          {t('events.sections.howTitle')}
        </h2>

        <ol className="space-y-4">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li
              key={key}
              className="flex gap-4 rounded-2xl border border-border/70 bg-card p-5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-mid text-sm font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-mid" aria-hidden />
                  <h3 className="font-semibold">{t(`events.sections.${key}Title`)}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`events.sections.${key}Body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
