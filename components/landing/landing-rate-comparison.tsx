'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReveal } from '@/lib/landing/use-scroll-motion'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CreditCard,
  Landmark,
  Percent,
  Scale,
  Users,
  Wallet,
} from 'lucide-react'

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

const FINANCING_OPTIONS: FinancingOption[] = [
  {
    id: 'mercato',
    label: 'Mercato',
    subtitle: 'PO-backed escrow on Stellar',
    rateLabel: '18–24% APR',
    rateMin: 18,
    rateMax: 24,
    requirements: 'Live PO + verified supplier — no banking history',
    access: 'high',
    icon: BadgeCheck,
    mercato: true,
    caveat: '100% of the production order financed',
  },
  {
    id: 'bank-mx',
    label: 'Commercial bank (with history)',
    subtitle: 'Tier-1 & regional banks',
    rateLabel: '19–21% CAT',
    rateMin: 19,
    rateMax: 21,
    requirements: '2+ years operating, revenue floors, bureau record, collateral',
    access: 'low',
    icon: Landmark,
    source: 'Regional bank disclosures 2025',
    caveat: '~15% of SMEs qualify for formal bank credit',
  },
  {
    id: 'fintech-factoring',
    label: 'Fintech factoring',
    subtitle: 'e.g. Xepelin',
    rateLabel: '18–36% annual',
    rateMin: 18,
    rateMax: 36,
    requirements: '~1 year invoicing history',
    access: 'medium',
    icon: Building2,
    source: 'Xepelin simulator 2024',
    caveat: 'Typically advances only ~80% of invoice value',
  },
  {
    id: 'business-card',
    label: 'SME business card',
    subtitle: 'Formal revolving credit',
    rateLabel: '18–22% CAT',
    rateMin: 18,
    rateMax: 22,
    requirements: 'Multi-year operating history + collateral',
    access: 'low',
    icon: CreditCard,
    source: 'Major bank card disclosures 2025',
  },
  {
    id: 'informal',
    label: 'Informal lenders',
    subtitle: 'Unregulated market',
    rateLabel: '60–120%+',
    rateMin: 60,
    rateMax: 120,
    requirements: 'No formal requirements — extreme cost',
    access: 'high',
    icon: Wallet,
    caveat: 'No protections; effective cost compounds fast',
  },
]

const STATS = [
  {
    value: '85%',
    label: 'of SMEs in LATAM lack access to formal bank credit',
    icon: Users,
  },
  {
    value: '100%',
    label: 'of the PO financed on Mercato — not 80% like factoring',
    icon: Scale,
  },
  {
    value: '18–24%',
    label: 'APR range — comparable to banks, without their barriers',
    icon: Percent,
  },
] as const

const RATE_SCALE_MAX = 120

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

function AccessPill({ level }: { level: AccessLevel }) {
  const config = {
    high: {
      label: 'Broad access',
      className: 'bg-brand-pale text-brand-dark dark:bg-brand-light/15 dark:text-brand-light',
    },
    medium: {
      label: 'Moderate barriers',
      className: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
    },
    low: {
      label: 'Strict requirements',
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
  const { ref, visible } = useReveal<HTMLElement>(0.08)

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-t border-border/50 bg-brand-ultra/40 py-20 dark:bg-muted/20 md:py-28"
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
              Why Mercato
            </p>
            <h2
              id="rate-comparison-heading"
              className="font-display mb-5 text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.06] tracking-tight text-foreground text-balance"
            >
              Bank-grade pricing.
              <br />
              <span className="text-brand-mid dark:text-brand-light">Without the bank-grade barriers.</span>
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              SMEs face 19–21% CAT at banks they often cannot access — or 60%+ from informal lenders.
              Mercato sits in the middle:{' '}
              <strong className="font-semibold text-foreground">18–24% APR</strong> on the full purchase order,
              validated by the deal itself — not your credit file.
            </p>
          </div>

          <div className="mb-12 grid gap-4 sm:grid-cols-3 md:mb-16">
            {STATS.map(({ value, label, icon: Icon }) => (
              <div
                key={label}
                className="glass rounded-2xl border border-brand-light/20 px-5 py-5 dark:border-white/10"
              >
                <Icon className="mb-3 h-5 w-5 text-brand-mid dark:text-brand-light" aria-hidden />
                <p className="font-display text-3xl font-normal tracking-tight text-foreground">{value}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 flex items-end justify-between gap-4 px-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Annual cost (APR / CAT)
            </p>
            <div className="hidden items-center gap-4 text-[10px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-6 rounded-full bg-gradient-to-r from-brand-mid to-brand-light" />
                Mercato
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-6 rounded-full bg-muted-foreground/35" />
                Alternatives
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {FINANCING_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <div
                  key={option.id}
                  className={cn(
                    'rounded-2xl border p-4 transition-shadow md:p-5',
                    option.mercato
                      ? 'border-brand-light/50 bg-gradient-to-br from-brand-pale/90 via-background to-brand-ultra shadow-glow-brand dark:border-brand-light/25 dark:from-brand-mid/10 dark:via-card dark:to-background'
                      : 'border-border/60 bg-card/80 dark:bg-card/50',
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
                    <div className="flex min-w-0 flex-1 items-start gap-3 lg:max-w-[280px]">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          option.mercato
                            ? 'bg-brand-mid text-white'
                            : 'bg-muted text-muted-foreground dark:bg-white/[0.06]',
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{option.label}</h3>
                          {option.mercato && (
                            <span className="rounded-full bg-brand-mid px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Best fit
                            </span>
                          )}
                        </div>
                        {option.subtitle && (
                          <p className="text-xs text-muted-foreground">{option.subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end lg:w-28">
                      <p
                        className={cn(
                          'text-xl font-bold tabular-nums tracking-tight',
                          option.mercato ? 'text-brand-mid dark:text-brand-light' : 'text-foreground',
                        )}
                      >
                        {option.rateLabel}
                      </p>
                      <AccessPill level={option.access} />
                    </div>

                    <div className="min-w-0 flex-[1.4]">
                      <RateBar min={option.rateMin} max={option.rateMax} highlighted={option.mercato} />
                    </div>

                    <div className="min-w-0 flex-1 lg:max-w-xs">
                      <p className="text-sm leading-relaxed text-muted-foreground">{option.requirements}</p>
                      {option.caveat && (
                        <p
                          className={cn(
                            'mt-1 text-xs font-medium',
                            option.mercato ? 'text-brand-mid dark:text-brand-light' : 'text-foreground/70',
                          )}
                        >
                          {option.caveat}
                        </p>
                      )}
                      {option.source && (
                        <p className="mt-1 text-[10px] text-muted-foreground/70">Source: {option.source}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-10 rounded-2xl border border-brand-light/30 bg-brand-dark px-6 py-6 text-white dark:border-brand-light/20 md:px-8 md:py-8">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-light">
              The real comparison
            </p>
            <p className="font-display max-w-3xl text-xl leading-snug tracking-tight text-white md:text-2xl">
              Mercato isn&apos;t cheaper than an informal lender — it&apos;s as{' '}
              <span className="text-brand-light">accessible</span> as one, priced closer to a{' '}
              <span className="text-brand-light">bank</span>, and built around the purchase order itself.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Rates shown reflect verified public data (banks, business cards, factoring platforms) and
              Mercato&apos;s target model. Individual deal APR depends on risk, term, and milestones.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-6 h-11 rounded-full bg-white px-7 font-semibold text-brand-dark hover:bg-brand-ultra"
            >
              <Link href="/auth/sign-up">
                Start with your next PO
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
