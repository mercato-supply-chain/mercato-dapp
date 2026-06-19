'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import {
  BadgeCheck,
  Building2,
  CreditCard,
  Landmark,
  Percent,
  Scale,
  Users,
  Wallet,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

type AccessLevel = 'high' | 'medium' | 'low'

type FinancingOption = {
  id: string
  label: string
  subtitle?: string
  rateLabel: string
  rateMin: number
  rateMax: number
  requirements: string
  access: AccessLevel
  icon: React.ElementType
  source?: string
  caveat?: string
  mercato?: boolean
}

const RATE_SCALE_MAX = 120

function useFinancingOptions(t: (key: string) => string): FinancingOption[] {
  return [
    {
      id: 'mercato',
      label: t('landing.rates.options.mercato.label'),
      subtitle: t('landing.rates.options.mercato.subtitle'),
      rateLabel: t('landing.rates.options.mercato.rate'),
      rateMin: 18,
      rateMax: 24,
      requirements: t('landing.rates.options.mercato.requirements'),
      access: 'high',
      icon: BadgeCheck,
      mercato: true,
      caveat: t('landing.rates.options.mercato.caveat'),
    },
    {
      id: 'bank-mx',
      label: t('landing.rates.options.bank.label'),
      subtitle: t('landing.rates.options.bank.subtitle'),
      rateLabel: t('landing.rates.options.bank.rate'),
      rateMin: 19,
      rateMax: 21,
      requirements: t('landing.rates.options.bank.requirements'),
      access: 'low',
      icon: Landmark,
      source: t('landing.rates.options.bank.source'),
      caveat: t('landing.rates.options.bank.caveat'),
    },
    {
      id: 'fintech-factoring',
      label: t('landing.rates.options.fintech.label'),
      subtitle: t('landing.rates.options.fintech.subtitle'),
      rateLabel: t('landing.rates.options.fintech.rate'),
      rateMin: 18,
      rateMax: 36,
      requirements: t('landing.rates.options.fintech.requirements'),
      access: 'medium',
      icon: Building2,
      source: t('landing.rates.options.fintech.source'),
      caveat: t('landing.rates.options.fintech.caveat'),
    },
    {
      id: 'business-card',
      label: t('landing.rates.options.card.label'),
      subtitle: t('landing.rates.options.card.subtitle'),
      rateLabel: t('landing.rates.options.card.rate'),
      rateMin: 18,
      rateMax: 22,
      requirements: t('landing.rates.options.card.requirements'),
      access: 'low',
      icon: CreditCard,
      source: t('landing.rates.options.card.source'),
    },
    {
      id: 'informal',
      label: t('landing.rates.options.informal.label'),
      subtitle: t('landing.rates.options.informal.subtitle'),
      rateLabel: t('landing.rates.options.informal.rate'),
      rateMin: 60,
      rateMax: 120,
      requirements: t('landing.rates.options.informal.requirements'),
      access: 'high',
      icon: Wallet,
      caveat: t('landing.rates.options.informal.caveat'),
    },
  ]
}

function RateBar({
  min,
  max,
  highlighted,
}: {
  min: number
  max: number
  highlighted?: boolean
}) {
  const left = (min / RATE_SCALE_MAX) * 100
  const width = Math.max(((max - min) / RATE_SCALE_MAX) * 100, 2.5)

  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/80 dark:bg-white/[0.06]"
      role="img"
      aria-label={`${min}% to ${max}% annual cost`}
    >
      <div
        className={cn(
          'absolute top-0 h-full rounded-full transition-all duration-700',
          highlighted
            ? 'bg-gradient-to-r from-brand-mid to-brand-light shadow-[0_0_12px_hsl(var(--brand-light)/0.45)]'
            : 'bg-muted-foreground/35 dark:bg-white/20',
        )}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  )
}

function AccessPill({ level, t }: { level: AccessLevel; t: (key: string) => string }) {
  const config = {
    high: {
      label: t('landing.rates.accessHigh'),
      className: 'bg-brand-pale text-brand-dark dark:bg-brand-light/15 dark:text-brand-light',
    },
    medium: {
      label: t('landing.rates.accessMedium'),
      className: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
    },
    low: {
      label: t('landing.rates.accessLow'),
      className: 'bg-muted text-muted-foreground',
    },
  }[level]

  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', config.className)}>
      {config.label}
    </span>
  )
}

export function LandingRateComparison() {
  const { t } = useI18n()
  const { ref, visible } = useReveal<HTMLElement>(0.08)
  const financingOptions = React.useMemo(() => useFinancingOptions(t), [t])
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center' }, [Autoplay({ delay: 5000 })])
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  React.useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', () => {
      setSelectedIndex(emblaApi.selectedScrollSnap())
    })
  }, [emblaApi])

  return (
    <section
      id="why-mercato"
      ref={ref}
      className="landing-section-anchor relative overflow-hidden border-t border-border/50 bg-brand-ultra/40 py-20 dark:bg-muted/20 md:py-28"
      aria-labelledby="rate-comparison-heading"
    >
      <div
        className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand-light/10 blur-[100px] dark:bg-brand-mid/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-brand-mid/8 blur-[90px]"
        aria-hidden
      />

      <div className="container relative mx-auto px-4">
        <div
          className={cn(
            'mx-auto max-w-6xl transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
          )}
        >
          <div className="mb-12 max-w-3xl md:mb-16">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid dark:text-brand-light">
              {t('landing.rates.eyebrow')}
            </p>
            <h2
              id="rate-comparison-heading"
              className="font-display mb-5 text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.06] tracking-tight text-foreground text-balance"
            >
              {t('landing.rates.titleLine1')}
              <br />
              <span className="text-brand-mid dark:text-brand-light">{t('landing.rates.titleAccent')}</span>
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t('landing.rates.description', { apr: t('landing.rates.aprHighlight') })}
            </p>
          </div>

          <div className="relative mb-12">
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex">
                {financingOptions.map((option, index) => {
                  const Icon = option.icon
                  const isActive = index === selectedIndex
                  
                  return (
                    <div key={option.id} className="flex-[0_0_100%] min-w-0 px-4 md:flex-[0_0_80%] lg:flex-[0_0_60%]">
                      <div
                        className={cn(
                          'relative h-full rounded-3xl border p-6 transition-all duration-500 md:p-10',
                          option.mercato
                            ? 'border-brand-light/50 bg-gradient-to-br from-brand-pale/90 via-background to-brand-ultra shadow-glow-brand dark:border-brand-light/25 dark:from-brand-mid/10 dark:via-card dark:to-background'
                            : 'border-border/60 bg-card/80 dark:bg-card/50',
                          !isActive && 'scale-95 opacity-40 grayscale blur-[1px]'
                        )}
                      >
                        <div className="flex flex-col gap-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div
                                className={cn(
                                  'flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm',
                                  option.mercato
                                    ? 'bg-brand-mid text-white'
                                    : 'bg-muted text-muted-foreground dark:bg-white/[0.06]',
                                )}
                              >
                                <Icon className="h-7 w-7" aria-hidden />
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <h3 className="text-xl font-bold text-foreground">{option.label}</h3>
                                  {option.mercato && (
                                    <span className="rounded-full bg-brand-mid px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                                      {t('landing.rates.bestFit')}
                                    </span>
                                  )}
                                </div>
                                {option.subtitle && (
                                  <p className="mt-1 text-sm text-muted-foreground">{option.subtitle}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={cn(
                                  'text-3xl font-bold tabular-nums tracking-tight',
                                  option.mercato ? 'text-brand-mid dark:text-brand-light' : 'text-foreground',
                                )}
                              >
                                {option.rateLabel}
                              </p>
                              <AccessPill level={option.access} t={t} />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              <span>{t('landing.rates.chartLabel')}</span>
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-4 rounded-full bg-brand-mid" />
                                  {t('landing.rates.chartLegendMercato')}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-4 rounded-full bg-muted-foreground/35" />
                                  {t('landing.rates.chartLegendAlt')}
                                </span>
                              </div>
                            </div>
                            <RateBar min={option.rateMin} max={option.rateMax} highlighted={option.mercato} />
                          </div>

                          <div className="grid gap-6 md:grid-cols-2">
                            <div className="rounded-2xl bg-muted/30 p-5 dark:bg-white/[0.02]">
                              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {t('landing.rates.requirementsLabel')}
                              </p>
                              <p className="text-sm leading-relaxed text-foreground/90">
                                {option.requirements}
                              </p>
                            </div>
                            {option.caveat && (
                              <div className="rounded-2xl border border-brand-light/20 bg-brand-pale/20 p-5 dark:border-white/5 dark:bg-white/[0.01]">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-mid dark:text-brand-light/70">
                                  {t('landing.rates.noteLabel')}
                                </p>
                                <p className="text-sm italic leading-relaxed text-muted-foreground">
                                  {option.caveat}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="mt-8 flex justify-center gap-2">
              {financingOptions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => emblaApi?.scrollTo(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === selectedIndex ? 'w-8 bg-brand-mid' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  )}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
