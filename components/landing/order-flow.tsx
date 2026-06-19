'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  Package,
  RefreshCw,
  Star,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'

type StepId = 'order' | 'fund' | 'produce' | 'deliver' | 'complete'

function useFlowSteps(t: (key: string, replacements?: Record<string, string | number>) => string) {
  return [
    {
      id: 'order' as const,
      n: '01',
      short: t('landing.flow.order.short'),
      title: t('landing.flow.order.title'),
      body: t('landing.flow.order.body'),
      actor: t('landing.flow.order.actor'),
      color: 'bg-brand-dark',
      ring: 'ring-brand-dark/30',
      icon: FileText,
    },
    {
      id: 'fund' as const,
      n: '02',
      short: t('landing.flow.fund.short'),
      title: t('landing.flow.fund.title'),
      body: t('landing.flow.fund.body'),
      actor: t('landing.flow.fund.actor'),
      color: 'bg-brand-mid',
      ring: 'ring-brand-mid/30',
      icon: Wallet,
    },
    {
      id: 'produce' as const,
      n: '03',
      short: t('landing.flow.produce.short'),
      title: t('landing.flow.produce.title'),
      body: t('landing.flow.produce.body'),
      actor: t('landing.flow.produce.actor'),
      color: 'bg-brand-light',
      ring: 'ring-brand-light/40',
      icon: Package,
    },
    {
      id: 'deliver' as const,
      n: '04',
      short: t('landing.flow.deliver.short'),
      title: t('landing.flow.deliver.title'),
      body: t('landing.flow.deliver.body'),
      actor: t('landing.flow.deliver.actor'),
      color: 'bg-brand-mid',
      ring: 'ring-brand-mid/30',
      icon: Truck,
    },
    {
      id: 'complete' as const,
      n: '05',
      short: t('landing.flow.complete.short'),
      title: t('landing.flow.complete.title'),
      body: t('landing.flow.complete.body'),
      actor: t('landing.flow.complete.actor'),
      color: 'bg-brand-dark',
      ring: 'ring-brand-dark/30',
      icon: RefreshCw,
    },
  ]
}

function StepVisual({ stepId, t }: { stepId: StepId; t: (key: string) => string }) {
  switch (stepId) {
    case 'order':
      return (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-mid">
              {t('landing.flow.visual.purchaseOrder')}
            </p>
            <span className="rounded-md bg-brand-pale px-2 py-0.5 text-[10px] font-semibold text-brand-mid dark:bg-white/[0.06] dark:text-brand-light">
              {t('landing.flow.visual.draftLive')}
            </span>
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand-pale bg-brand-ultra/80 p-2.5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-dark text-[10px] font-bold text-white">AP</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Acero del Pacífico</p>
              <p className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {t('landing.flow.visual.verified')}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {[t('landing.flow.visual.milestone1'), t('landing.flow.visual.milestone2')].map((m) => (
              <div key={m} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-brand-mid" aria-hidden />
                {m}
              </div>
            ))}
          </div>
        </div>
      )
    case 'fund':
      return (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-md">
          <div className="mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Lock className="h-4 w-4" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-wider">Escrow locked</p>
          </div>
          <p className="mb-1 text-3xl font-bold tabular-nums text-foreground">$48,500</p>
          <p className="mb-3 text-xs text-muted-foreground">USDC on Stellar · milestone-gated</p>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">12.5% APR · InverCap SA funded</p>
          </div>
        </div>
      )
    case 'produce':
      return (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-md">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Production</p>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-brand-mid to-brand-light" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50 p-2 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <p className="text-[9px] text-muted-foreground">Milestone 1</p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Released</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-2">
              <p className="text-[9px] text-muted-foreground">Milestone 2</p>
              <p className="text-sm font-bold text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
      )
    case 'deliver':
      return (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-md">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-pale dark:bg-white/[0.06]">
              <Truck className="h-5 w-5 text-brand-mid dark:text-brand-light" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold">Delivery confirmed</p>
              <p className="text-[10px] text-muted-foreground">Proof uploaded on-chain</p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-brand-mid/40 bg-brand-ultra/50 px-3 py-2 text-center dark:bg-white/[0.04]">
            <p className="text-xs font-medium text-brand-mid dark:text-brand-light">Final 50% → supplier</p>
          </div>
        </div>
      )
    case 'complete':
      return (
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-md">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Settlement</p>
          <div className="space-y-2">
            {[
              { who: 'Investors', amt: '+$2,430 yield', ok: true },
              { who: 'Supplier', amt: 'Paid in full', ok: true },
              { who: 'SME', amt: 'Deal closed ✓', ok: true },
            ].map((row) => (
              <div key={row.who} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                <span className="text-xs font-medium">{row.who}</span>
                <span className="text-xs font-bold text-brand-mid dark:text-brand-light">{row.amt}</span>
              </div>
            ))}
          </div>
        </div>
      )
  }
}

export function OrderFlow() {
  const { t } = useI18n()
  const { ref, visible } = useReveal(0.12)
  const [active, setActive] = React.useState(0)
  const [panelKey, setPanelKey] = React.useState(0)
  const steps = React.useMemo(() => useFlowSteps(t), [t])

  const step = steps[active]
  const StepIcon = step.icon

  React.useEffect(() => {
    if (!visible) return
    const id = setInterval(() => {
      setActive((a) => {
        const next = (a + 1) % steps.length
        setPanelKey((k) => k + 1)
        return next
      })
    }, 3200)
    return () => clearInterval(id)
  }, [visible])

  const selectStep = (i: number) => {
    if (i === active) return
    setActive(i)
    setPanelKey((k) => k + 1)
  }

  return (
    <div ref={ref} className="relative">
      {/* Desktop timeline */}
      <div className="mb-8 hidden md:block">
        <div className="relative px-1">
          <div
            className="absolute left-[10%] right-[10%] top-[1.35rem] h-1 overflow-hidden rounded-full bg-brand-pale dark:bg-white/[0.06]"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-dark via-brand-mid to-brand-light transition-[width] duration-700 ease-out"
              style={{ width: visible ? `${((active + 1) / steps.length) * 100}%` : '0%' }}
            />
          </div>

          <div className="relative flex justify-between">
            {steps.map((s, i) => {
              const Icon = s.icon
              const isActive = active === i
              const isPast = i < active
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectStep(i)}
                  className="group flex w-[18%] flex-col items-center gap-2 text-center"
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'relative flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-all duration-500',
                      s.color,
                      isActive && 'scale-110 ring-4 ring-brand-light/40 shadow-glow-brand',
                      !isActive && !isPast && 'scale-90 opacity-45 group-hover:opacity-80',
                      isPast && !isActive && 'scale-95 opacity-70',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                    {isActive && (
                      <span className="absolute -inset-1 rounded-full border-2 border-brand-light/50 motion-safe:animate-ping" aria-hidden />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider transition-colors',
                      isActive ? 'text-brand-mid dark:text-brand-light' : 'text-muted-foreground',
                    )}
                  >
                    {s.short}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detail panel — desktop */}
      <div
        key={panelKey}
        className="tab-panel-enter hidden overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-brand-ultra/80 via-card to-background shadow-elevated dark:from-[hsl(0,0%,4%)] dark:via-card dark:to-background md:block"
      >
        <div className="grid lg:grid-cols-[1fr_1.05fr]">
          <div className="relative border-b border-border/60 p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div
              className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full bg-brand-light/15 blur-3xl"
              aria-hidden
            />
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid">
              {t('landing.flow.stepLabel', { n: step.n })}
            </p>
            <h3 className="font-display mb-3 text-2xl leading-tight text-foreground md:text-[1.75rem]">
              {step.title}
            </h3>
            <p className="mb-6 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
              {step.body}
            </p>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-pale bg-background/80 px-3 py-1 text-xs font-semibold text-foreground dark:border-white/10">
              <StepIcon className="h-3.5 w-3.5 text-brand-mid dark:text-brand-light" aria-hidden />
              {step.actor}
            </span>

            <div className="mt-8 flex items-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectStep(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === active ? 'w-8 bg-brand-mid' : 'w-2 bg-brand-pale hover:bg-brand-light/60 dark:bg-white/10',
                  )}
                  aria-label={t('landing.flow.stepAria', { n: i + 1 })}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center bg-muted/20 p-8 dark:bg-muted/5 lg:p-10">
            <div className="w-full max-w-sm">
              <StepVisual stepId={step.id} t={t} />
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden />
                {t('landing.flow.footnote')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectStep(i)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                  active === i
                    ? 'bg-brand-mid text-white shadow-md'
                    : 'bg-muted/50 text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {s.short}
              </button>
            )
          })}
        </div>

        <article
          key={panelKey}
          className="tab-panel-enter overflow-hidden rounded-2xl border border-brand-light/30 bg-card shadow-elevated"
        >
          <div className="border-b border-border bg-brand-ultra/50 p-5 dark:bg-white/[0.04]">
            <StepVisual stepId={step.id} t={t} />
          </div>
          <div className="p-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-mid">
              {t('landing.flow.stepLabel', { n: step.n })}
            </p>
            <h3 className="font-display mb-2 text-xl text-foreground">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-brand-mid dark:text-brand-light">
              {step.actor}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}
