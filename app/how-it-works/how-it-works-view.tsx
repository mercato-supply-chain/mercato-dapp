'use client'

import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Package,
  TrendingUp,
  Users,
  ShieldCheck,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Lock,
  Zap,
  Globe,
  ArrowDown,
  Star,
  BarChart3,
  FileCheck,
  RefreshCw,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

const ROLE_ORDER = ['smb', 'investor', 'supplier'] as const

const ROLE_META = [
  {
    icon: Package,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    dotColor: 'bg-blue-500',
  },
  {
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    dotColor: 'bg-emerald-500',
  },
  {
    icon: Users,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    dotColor: 'bg-amber-500',
  },
] as const

const PHASE_META = [
  {
    actorColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    numBg: 'bg-blue-500',
    icon: FileCheck,
    iconBg: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-500',
    techIcons: [Lock, Globe] as const,
  },
  {
    actorColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    numBg: 'bg-emerald-500',
    icon: Wallet,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    iconColor: 'text-emerald-500',
    techIcons: [Zap, Lock] as const,
  },
  {
    actorColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    numBg: 'bg-amber-500',
    icon: Package,
    iconBg: 'bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-500',
    techIcons: [ShieldCheck, FileCheck] as const,
  },
  {
    actorColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    numBg: 'bg-violet-500',
    icon: RefreshCw,
    iconBg: 'bg-violet-50 dark:bg-violet-950/30',
    iconColor: 'text-violet-500',
    techIcons: [CheckCircle2, Star] as const,
  },
] as const

const BENEFIT_META = [
  { icon: Lock, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { icon: BarChart3, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { icon: Globe, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/30' },
] as const

const hiwEnter =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-out motion-safe:fill-mode-both'

const hiwCardHover =
  'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-colors motion-reduce:hover:translate-y-0'

function hiwPhaseNumPulseClass(n: number) {
  return cn(
    'origin-center motion-reduce:animate-none',
    n === 1 && 'motion-safe:animate-mercato-cycle-step-1',
    n === 2 && 'motion-safe:animate-mercato-cycle-step-2',
    n === 3 && 'motion-safe:animate-mercato-cycle-step-3',
    n === 4 && 'motion-safe:animate-mercato-cycle-step-4',
  )
}

export function HowItWorksView() {
  const { messages } = useI18n()
  const hiw = messages.howItWorks

  const heroPills = [
    { icon: Lock, label: hiw.hero.pillEscrow },
    { icon: Zap, label: hiw.hero.pillUsdc },
    { icon: Globe, label: hiw.hero.pillLatam },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-transparent">
        <div className="container mx-auto max-w-4xl px-4 py-20 text-center">
          <Badge variant="secondary" className={cn('mb-5 gap-1.5 px-3 py-1', hiwEnter)}>
            <Zap className="h-3.5 w-3.5" aria-hidden />
            {hiw.hero.badge}
          </Badge>
          <h1
            className={cn(
              'mb-5 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl',
              hiwEnter,
              'motion-safe:delay-75',
            )}
          >
            {hiw.hero.title}
          </h1>
          <p
            className={cn(
              'mx-auto mb-8 max-w-2xl text-lg text-muted-foreground',
              hiwEnter,
              'motion-safe:delay-150',
            )}
          >
            {hiw.hero.description}
          </p>
          <div
            className={cn(
              'flex flex-wrap items-center justify-center gap-3 text-sm',
              hiwEnter,
              'motion-safe:delay-200',
            )}
          >
            {heroPills.map(({ icon: Icon, label }, i) => (
              <span
                key={label}
                style={{ animationDelay: `${220 + i * 60}ms` }}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 font-medium',
                  hiwEnter,
                  'motion-safe:fill-mode-backwards',
                )}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-16" aria-labelledby="hiw-roles-heading">
        <div className="mb-10 text-center">
          <h2
            id="hiw-roles-heading"
            className={cn('mb-2 text-2xl font-bold tracking-tight sm:text-3xl', hiwEnter)}
          >
            {hiw.rolesHeading}
          </h2>
          <p className={cn('text-muted-foreground', hiwEnter, 'motion-safe:delay-100')}>
            {hiw.rolesSub}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {ROLE_ORDER.map((key, i) => {
            const role = hiw.roles[key]
            const meta = ROLE_META[i]
            const Icon = meta.icon
            return (
              <div
                key={key}
                style={{ animationDelay: `${i * 90}ms` }}
                className={cn(
                  'group rounded-xl border p-6',
                  hiwEnter,
                  hiwCardHover,
                  'motion-safe:fill-mode-backwards',
                  meta.bg,
                  meta.border,
                )}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg bg-white/60 transition-transform duration-200 dark:bg-black/20',
                      'group-hover:scale-[1.04] motion-reduce:group-hover:scale-100',
                    )}
                  >
                    <Icon className={cn('h-5 w-5', meta.color)} aria-hidden />
                  </div>
                  <h3 className={cn('font-semibold', meta.color)}>{role.label}</h3>
                </div>
                <p className="mb-4 text-sm text-muted-foreground leading-relaxed">{role.tagline}</p>
                <ul className="space-y-2">
                  {role.actions.map((action) => (
                    <li key={action} className="flex items-start gap-2 text-sm">
                      <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotColor}`} />
                      <span className="text-foreground/80">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-t border-border bg-muted/20 py-16" aria-labelledby="hiw-flow-heading">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="mb-12 text-center">
            <Badge variant="outline" className={cn('mb-4', hiwEnter)}>
              {hiw.flowBadge}
            </Badge>
            <h2
              id="hiw-flow-heading"
              className={cn('mb-2 text-2xl font-bold tracking-tight sm:text-3xl', hiwEnter, 'motion-safe:delay-75')}
            >
              {hiw.flowTitle}
            </h2>
            <p className={cn('text-muted-foreground', hiwEnter, 'motion-safe:delay-150')}>
              {hiw.flowSub}
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500 to-violet-500 opacity-30 hidden sm:block" />

            <div className="space-y-0">
              {hiw.phases.map((phase, index) => {
                const meta = PHASE_META[index]
                const PhaseIcon = meta.icon
                return (
                  <div key={phase.title} className="relative">
                    <div
                      style={{ animationDelay: `${index * 100}ms` }}
                      className={cn('flex gap-5 sm:gap-8', hiwEnter, 'motion-safe:fill-mode-backwards')}
                    >
                      <div className="relative flex flex-col items-center">
                        <div
                          className={cn(
                            'z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white font-bold text-lg shadow-md',
                            meta.numBg,
                            hiwPhaseNumPulseClass(index + 1),
                          )}
                        >
                          {index + 1}
                        </div>
                      </div>

                      <div
                        className={cn(
                          'group mb-6 flex-1 rounded-xl border border-border bg-background p-5 shadow-sm',
                          hiwCardHover,
                        )}
                      >
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200',
                                meta.iconBg,
                                'group-hover:scale-[1.05] motion-reduce:group-hover:scale-100',
                              )}
                            >
                              <PhaseIcon className={cn('h-5 w-5', meta.iconColor)} aria-hidden />
                            </div>
                            <div>
                              <h3 className="font-semibold leading-tight">{phase.title}</h3>
                              <span
                                className={`mt-0.5 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${meta.actorColor}`}
                              >
                                {phase.actor}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="mb-4 text-sm text-muted-foreground leading-relaxed">{phase.description}</p>

                        <div className="mb-4 grid gap-1.5 sm:grid-cols-2">
                          {phase.actions.map((label) => (
                            <div key={label} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.iconColor}`} />
                              <span className="text-foreground/80">{label}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                          {phase.tech.map((label, ti) => {
                            const TechIcon = meta.techIcons[ti]
                            return (
                              <span
                                key={label}
                                className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                              >
                                <TechIcon className="h-3 w-3" />
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {index < hiw.phases.length - 1 && (
                      <div className="mb-1 flex items-center justify-center sm:justify-start sm:pl-[3.25rem]">
                        <ArrowDown
                          className="h-5 w-5 text-muted-foreground/40 motion-safe:animate-mercato-flow-down motion-reduce:animate-none"
                          style={{ animationDelay: `${index * 1000}ms` }}
                          aria-hidden
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-16" aria-labelledby="hiw-why-heading">
        <div className="mb-10 text-center">
          <h2 id="hiw-why-heading" className={cn('mb-2 text-2xl font-bold tracking-tight sm:text-3xl', hiwEnter)}>
            {hiw.whyTitle}
          </h2>
          <p className={cn('text-muted-foreground', hiwEnter, 'motion-safe:delay-100')}>
            {hiw.whySub}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {hiw.benefits.map((b, i) => {
            const bm = BENEFIT_META[i]
            const BenefitIcon = bm.icon
            return (
              <div
                key={b.title}
                style={{ animationDelay: `${i * 80}ms` }}
                className={cn(
                  'group rounded-xl border border-border bg-background p-5',
                  hiwEnter,
                  hiwCardHover,
                  'motion-safe:fill-mode-backwards',
                )}
              >
                <div
                  className={cn(
                    'mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-200',
                    bm.bg,
                    'group-hover:scale-[1.05] motion-reduce:group-hover:scale-100',
                  )}
                >
                  <BenefitIcon className={cn('h-5 w-5', bm.color)} aria-hidden />
                </div>
                <h3 className="mb-2 font-semibold">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-t border-border bg-muted/20 py-10" aria-labelledby="hiw-powered-heading">
        <div className="container mx-auto max-w-4xl px-4">
          <p
            id="hiw-powered-heading"
            className={cn(
              'mb-6 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground',
              hiwEnter,
            )}
          >
            {hiw.poweredBy}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {hiw.techStack.map((item, i) => (
              <div
                key={item.label}
                style={{ animationDelay: `${i * 70}ms` }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border border-border bg-background p-4 text-center',
                  hiwEnter,
                  hiwCardHover,
                  'motion-safe:fill-mode-backwards',
                )}
              >
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-4xl px-4 py-12">
        <div
          className={cn(
            'rounded-xl border border-border bg-gradient-to-r from-primary/5 to-transparent p-6 sm:p-8',
            hiwEnter,
            hiwCardHover,
          )}
        >
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <RefreshCw
                className="h-6 w-6 text-primary motion-safe:animate-spin motion-safe:[animation-duration:12s] motion-reduce:animate-none"
                aria-hidden
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="mb-1 text-lg font-semibold">{hiw.fiatTitle}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{hiw.fiatDescription}</p>
              <div className="flex flex-wrap gap-3">
                {hiw.rampProviders.map((p, i) => (
                  <div
                    key={p.name}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className={cn(
                      'rounded-lg border border-border bg-background px-4 py-2',
                      hiwEnter,
                      'motion-safe:fill-mode-backwards',
                    )}
                  >
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.region}</p>
                  </div>
                ))}
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/dashboard/ramp">
                {hiw.addFunds}
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/20 py-16" aria-labelledby="hiw-cta-heading">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 id="hiw-cta-heading" className={cn('mb-3 text-2xl font-bold sm:text-3xl', hiwEnter)}>
            {hiw.ctaTitle}
          </h2>
          <p className={cn('mb-8 text-muted-foreground', hiwEnter, 'motion-safe:delay-100')}>
            {hiw.ctaDescription}
          </p>
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-3 sm:flex-row',
              hiwEnter,
              'motion-safe:delay-200',
            )}
          >
            <Button size="lg" asChild>
              <Link href="/auth/sign-up">
                {hiw.ctaSignUp}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/deals">{hiw.ctaBrowse}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
