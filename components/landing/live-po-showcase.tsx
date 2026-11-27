'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { CheckCircle2, ArrowRight, TrendingUp, ShieldCheck, Star, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/provider'

export function LivePOShowcase() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const stages = React.useMemo(
    () => [
      { label: t('landing.showcase.stageCreated') },
      { label: t('landing.showcase.stageFunded') },
      { label: t('landing.showcase.stageProduction'), active: true },
      { label: t('landing.showcase.stageShipped') },
      { label: t('landing.showcase.stageSettled') },
    ],
    [t],
  )

  const metrics = React.useMemo(
    () => [
      {
        label: t('landing.showcase.metricOrderValue'),
        value: '$48,500',
        sub: 'USDC',
        accent: false,
      },
      {
        label: t('landing.showcase.metricTimeline'),
        value: 'Day 18',
        sub: t('landing.showcase.metricDayOf', { total: 45 }),
        accent: false,
      },
    ],
    [t],
  )

  const events = React.useMemo(
    () => [
      { icon: TrendingUp, text: t('landing.showcase.event0'), time: t('landing.showcase.event0Time') },
      { icon: ShieldCheck, text: t('landing.showcase.event1'), time: t('landing.showcase.event1Time') },
      { icon: CheckCircle2, text: t('landing.showcase.event2'), time: t('landing.showcase.event2Time') },
    ],
    [t],
  )

  const pills = React.useMemo(
    () => [
      { icon: ShieldCheck, text: t('landing.showcase.pillSuppliers') },
      { icon: Star, text: t('landing.showcase.pillReputation') },
      { icon: TrendingUp, text: t('landing.showcase.pillApr') },
    ],
    [t],
  )

  const [mounted, setMounted] = React.useState(false)
  const [bar, setBar] = React.useState(0)
  const [eventIdx, setEventIdx] = React.useState(0)

  React.useEffect(() => setMounted(true), [])
  React.useEffect(() => {
    const t1 = setTimeout(() => setBar(40), 400)
    const id = setInterval(() => setEventIdx((n) => (n + 1) % events.length), 3000)
    return () => {
      clearTimeout(t1)
      clearInterval(id)
    }
  }, [events.length])

  const isDark = mounted && resolvedTheme === 'dark'
  const ev = events[eventIdx]
  const EvIcon = ev.icon

  return (
    <div className="w-full">
      <div
        className={cn(
          'overflow-hidden rounded-2xl border shadow-2xl',
          isDark
            ? 'border-white/10 bg-[hsl(var(--landing-product-bg))] shadow-black/60'
            : 'border-border bg-card shadow-brand-dark/10',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 border-b px-4 py-3',
            isDark ? 'border-white/8 bg-[hsl(var(--landing-product-chrome))]' : 'border-border bg-brand-ultra',
          )}
        >
          <span className="h-3 w-3 rounded-full bg-red-400/90" />
          <span className="h-3 w-3 rounded-full bg-amber-400/90" />
          <span className="h-3 w-3 rounded-full bg-green-500/90" />
          <div
            className={cn(
              'mx-auto flex items-center gap-2 rounded-md px-3 py-1 text-xs',
              isDark ? 'bg-[hsl(var(--landing-product-bg))] text-white/35' : 'bg-background text-muted-foreground',
            )}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-light" />
            app.mercato.finance / orders / MKT-2847
          </div>
        </div>

        <div className={cn('space-y-4 p-5', isDark ? 'bg-[hsl(var(--landing-product-bg))]' : 'bg-card')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-light opacity-60" />
                  <span className="relative h-2 w-2 rounded-full bg-brand-light" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-brand-mid dark:text-brand-light">
                  {t('landing.showcase.status')}
                </span>
              </div>
              <p className={cn('text-lg font-bold leading-tight', isDark ? 'text-white' : 'text-foreground')}>
                {t('landing.showcase.poTitle')}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <span>Industrias NOVA</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                <span className="flex items-center gap-1">
                  Acero del Pacífico
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-light" />
                </span>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-brand-light/30 bg-brand-pale px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-mid dark:border-brand-light/25 dark:bg-white/[0.06] dark:text-brand-light">
              {t('landing.showcase.poId')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map((m) => (
              <div
                key={m.label}
                className={cn(
                  'rounded-xl border p-3 text-center',
                  m.accent
                    ? 'border-brand-light/40 bg-brand-pale dark:border-brand-light/20 dark:bg-white/[0.06]'
                    : isDark
                      ? 'border-white/5 bg-white/[0.04]'
                      : 'border-border bg-muted/40',
                )}
              >
                <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    m.accent ? 'text-brand-mid dark:text-brand-light' : isDark ? 'text-white' : 'text-foreground',
                  )}
                >
                  {m.value}
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">{m.sub}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex justify-between">
              {stages.map((s) => (
                <span
                  key={s.label}
                  className={cn(
                    'text-[9px] font-semibold uppercase tracking-wide leading-tight',
                    s.active ? 'text-brand-mid dark:text-brand-light' : 'text-muted-foreground/50',
                  )}
                >
                  {s.label}
                </span>
              ))}
            </div>
            <div
              className={cn('relative h-1.5 overflow-hidden rounded-full', isDark ? 'bg-white/10' : 'bg-brand-pale')}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-dark to-brand-light transition-[width] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${bar}%` }}
              />
              <div className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent motion-safe:animate-mercato-shimmer motion-reduce:hidden" />
            </div>
          </div>

          <div
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3',
              isDark ? 'border-brand-light/10 bg-white/[0.03]' : 'border-border bg-brand-ultra/80',
            )}
          >
            <div className="flex -space-x-2">
              {['IN', 'AP', 'IC'].map((i, idx) => (
                <div
                  key={i}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2',
                    idx === 0 && 'bg-brand-dark ring-background',
                    idx === 1 && 'bg-brand-mid ring-background',
                    idx === 2 && 'bg-brand-light ring-background',
                  )}
                >
                  {i}
                </div>
              ))}
            </div>
            <div className="min-w-0">
              <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-foreground')}>
                {t('landing.showcase.participantsLine')}
              </p>
              <p className="text-[10px] text-muted-foreground">{t('landing.showcase.participantsPaid')}</p>
            </div>
          </div>

          <div
            key={eventIdx}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border border-brand-light/25 bg-brand-pale p-3 dark:bg-white/[0.05]',
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500',
            )}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light/20">
              <EvIcon className="h-3.5 w-3.5 text-brand-mid dark:text-brand-light" />
            </div>
            <p className="flex-1 text-[11px] leading-tight text-foreground/80">{ev.text}</p>
            <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {ev.time}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {pills.map(({ icon: Icon, text }) => (
          <span
            key={text}
            className="flex items-center gap-1.5 rounded-full border border-brand-light/25 bg-brand-pale px-3 py-1.5 text-[11px] font-medium text-brand-mid dark:bg-white/[0.04] dark:text-brand-light"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-brand-light" />
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
