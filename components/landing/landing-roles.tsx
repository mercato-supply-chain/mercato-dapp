'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Star,
  Zap,
  Package,
  Lock,
} from 'lucide-react'

type RoleId = 'sme' | 'investor' | 'supplier'

const ROLES: {
  id: RoleId
  num: string
  label: string
  icon: React.ElementType
  headline: string
  subhead: string
  body: string
  bullets: string[]
  cta: { label: string; href: string }
  accent: string
  accentBorder: string
  panelBg: string
  watermark: string
}[] = [
  {
    id: 'sme',
    num: '01',
    label: 'SMEs',
    icon: Zap,
    headline: 'Stop waiting on capital.',
    subhead: 'Start shipping.',
    body: 'Create a purchase order, choose a verified supplier, set milestones — then open it to investors. Working capital in hours, not bank cycles.',
    bullets: [
      'Deploy a PO in minutes',
      'Build reputation with every deal',
      'Repay from inventory sales',
    ],
    cta: { label: 'Create your first deal', href: '/auth/sign-up' },
    accent: 'text-brand-mid dark:text-brand-light',
    accentBorder: 'border-brand-mid bg-brand-mid',
    panelBg: 'bg-gradient-to-br from-brand-ultra via-background to-brand-pale/40 dark:from-[hsl(0,0%,5%)] dark:via-card dark:to-background',
    watermark: 'text-brand-mid/10 dark:text-brand-light/10',
  },
  {
    id: 'investor',
    num: '02',
    label: 'Investors',
    icon: TrendingUp,
    headline: 'Yield on real trade.',
    subhead: 'Not speculation.',
    body: 'Browse open purchase orders, fund escrow on Stellar, and earn 8–15% APR while production and delivery milestones protect your capital.',
    bullets: [
      'See exactly what you fund',
      'Milestone-gated releases',
      '30–90 day terms',
    ],
    cta: { label: 'Browse open deals', href: '/deals' },
    accent: 'text-emerald-700 dark:text-emerald-400',
    accentBorder: 'border-emerald-600 bg-emerald-600',
    panelBg: 'bg-gradient-to-br from-emerald-50/90 via-background to-teal-50/30 dark:from-emerald-950/20 dark:via-card dark:to-background',
    watermark: 'text-emerald-600/10 dark:text-emerald-400/10',
  },
  {
    id: 'supplier',
    num: '03',
    label: 'Suppliers',
    icon: Package,
    headline: 'Get paid as you deliver.',
    subhead: 'Every milestone.',
    body: 'USDC is locked before you produce. Payments release when shipment and delivery are confirmed — no chasing invoices across borders.',
    bullets: [
      'Funds secured upfront',
      'Verified supplier profile',
      'Repeat buyers on Mercato',
    ],
    cta: { label: 'Join as supplier', href: '/auth/sign-up' },
    accent: 'text-amber-800 dark:text-amber-400',
    accentBorder: 'border-amber-600 bg-amber-600',
    panelBg: 'bg-gradient-to-br from-amber-50/80 via-background to-orange-50/25 dark:from-amber-950/15 dark:via-card dark:to-background',
    watermark: 'text-amber-600/10 dark:text-amber-400/10',
  },
]

function SmeMockup() {
  const { t } = useI18n()
  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-elevated">
      <div className="border-b border-border bg-brand-ultra/80 px-4 py-3 dark:bg-white/[0.04]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-mid">{t('landing.roles.sme.mockupTitle')}</p>
        <p className="text-sm font-bold text-foreground">{t('landing.roles.sme.mockupSubtitle')}</p>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-brand-pale bg-brand-ultra/50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-dark text-xs font-bold text-white">AP</div>
          <div>
            <p className="text-sm font-semibold">Acero del Pacífico</p>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.8 · {t('landing.roles.smeMockupOrders')}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[10px] text-muted-foreground">{t('landing.showcase.metricOrderValue')}</p>
          <p className="text-2xl font-bold tabular-nums">$48,500 <span className="text-sm font-medium text-muted-foreground">USDC</span></p>
        </div>
        <div className="rounded-xl bg-brand-dark py-2.5 text-center text-sm font-bold text-white">{t('landing.roles.smeMockupOpenCta')}</div>
      </div>
    </div>
  )
}

function InvestorMockup() {
  const { t } = useI18n()
  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-elevated">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-bold">{t('landing.roles.investorMockupTitle')}</p>
        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{t('landing.roles.investorMockupAvg')}</span>
      </div>
      <div className="space-y-2 p-3">
        {[
          { n: 'Industrias NOVA', apr: '12.5%', a: '$48,500', w: 100 },
          { n: 'GranoMex SA', apr: '10.2%', a: '$22,000', w: 62 },
          { n: 'TechParts MX', apr: '14.1%', a: '$91,200', w: 38 },
        ].map((d) => (
          <div key={d.n} className="rounded-xl border border-border bg-background p-3">
            <div className="mb-1 flex justify-between gap-2">
              <p className="truncate text-sm font-semibold">{d.n}</p>
              <p className="shrink-0 text-sm font-bold text-emerald-600">{d.apr}</p>
            </div>
            <p className="mb-1.5 text-xs text-muted-foreground">{d.a}</p>
            <div className="h-1 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${d.w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SupplierMockup() {
  const { t } = useI18n()
  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-elevated">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-xs font-bold text-white">AP</div>
        <div>
          <p className="text-sm font-bold">Acero del Pacífico</p>
          <p className="text-[10px] text-muted-foreground">{t('landing.roles.supplier.mockupVerified')}</p>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <div className="flex justify-between text-xs font-semibold">
            <span>{t('landing.roles.supplier.mockupProduction')}</span>
            <span className="text-emerald-700 dark:text-emerald-400">✓ $24,250</span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-300">{t('landing.roles.supplier.mockupPaid')}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex justify-between text-xs font-semibold text-muted-foreground">
            <span>{t('landing.roles.supplier.mockupDelivery')}</span>
            <span>{t('landing.roles.supplier.mockupPending')}</span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-muted-foreground">$24,250</p>
        </div>
      </div>
    </div>
  )
}

const MOCKUPS: Record<RoleId, React.ReactNode> = {
  sme: <SmeMockup />,
  investor: <InvestorMockup />,
  supplier: <SupplierMockup />,
}

export function LandingRoles() {
  const { t } = useI18n()
  const { ref, visible } = useReveal<HTMLElement>(0.1)
  const [active, setActive] = React.useState<RoleId>('sme')
  const [panelKey, setPanelKey] = React.useState(0)

  const roles = React.useMemo(
    () =>
      ROLES.map((r) => ({
        ...r,
        label: t(`landing.roles.${r.id}.label`),
        headline: t(`landing.roles.${r.id}.headline`),
        subhead: t(`landing.roles.${r.id}.subhead`),
        body: t(`landing.roles.${r.id}.body`),
        bullets: [
          t(`landing.roles.${r.id}.bullet1`),
          t(`landing.roles.${r.id}.bullet2`),
          t(`landing.roles.${r.id}.bullet3`),
        ],
        cta: { ...r.cta, label: t(`landing.roles.${r.id}.cta`) },
      })),
    [t],
  )

  const role = roles.find((r) => r.id === active)!
  const Icon = role.icon

  const selectRole = (id: RoleId) => {
    if (id === active) return
    setActive(id)
    setPanelKey((k) => k + 1)
  }

  return (
    <section
      id="roles"
      ref={ref}
      className="landing-section-anchor relative overflow-hidden bg-background py-24 md:py-32"
    >
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div
            className={cn(
              'mb-10 md:mb-12',
              'transition-all duration-700 ease-out motion-reduce:transition-none',
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
            )}
          >
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid">
              {t('landing.roles.eyebrow')}
            </p>
            <h2 className="font-display max-w-2xl text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.05] tracking-tight text-foreground text-balance">
              {t('landing.roles.titleLine1')}
              <br />
              <span className="text-muted-foreground">{t('landing.roles.titleLine2')}</span>
            </h2>
          </div>

          <div
            className={cn(
              'overflow-hidden rounded-3xl border border-border/70 bg-card shadow-elevated transition-all duration-700 delay-100',
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
            )}
          >
            {/* Mobile role picker */}
            <div className="flex gap-2 overflow-x-auto border-b border-border bg-muted/20 p-3 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {roles.map((r) => {
                const RIcon = r.icon
                const isActive = r.id === active
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRole(r.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-foreground text-background'
                        : 'bg-background text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    <RIcon className="h-4 w-4" aria-hidden />
                    {r.label}
                  </button>
                )
              })}
            </div>

            <div className="grid lg:grid-cols-[minmax(220px,260px)_1fr]">
              {/* Desktop rail */}
              <nav
                className="hidden flex-col border-r border-border bg-muted/15 lg:flex"
                aria-label={t('landing.roles.chooseRoleAria')}
              >
                {roles.map((r) => {
                  const RIcon = r.icon
                  const isActive = r.id === active
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => selectRole(r.id)}
                      className={cn(
                        'group relative flex flex-1 flex-col items-start gap-3 border-b border-border/60 px-6 py-8 text-left transition-all duration-300 last:border-b-0',
                        isActive
                          ? 'bg-background'
                          : 'hover:bg-background/60',
                      )}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span
                        className={cn(
                          'absolute left-0 top-6 bottom-6 w-1 rounded-r-full transition-all duration-300',
                          isActive ? r.accentBorder : 'bg-transparent',
                        )}
                        aria-hidden
                      />
                      <span className="font-display text-3xl text-muted-foreground/30 transition-colors group-aria-current:text-brand-mid/40">
                        {r.num}
                      </span>
                      <span className="flex items-center gap-2">
                        <RIcon
                          className={cn('h-5 w-5', isActive ? r.accent : 'text-muted-foreground')}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            'text-lg font-semibold',
                            isActive ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {r.label}
                        </span>
                      </span>
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {r.headline} {r.subhead}
                      </span>
                    </button>
                  )
                })}
              </nav>

              {/* Detail panel */}
              <div
                key={panelKey}
                className={cn(
                  'tab-panel-enter relative min-h-[32rem] overflow-hidden p-6 md:p-10 lg:min-h-[520px]',
                  role.panelBg,
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none absolute -right-4 -top-6 font-display text-[12rem] font-normal leading-none select-none',
                    role.watermark,
                  )}
                  aria-hidden
                >
                  {role.num}
                </span>

                <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
                  <div className="order-2 lg:order-1">{MOCKUPS[active]}</div>

                  <div className="order-1 lg:order-2">
                    <p
                      className={cn(
                        'mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]',
                        role.accent,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {t('landing.roles.forRole', { role: role.label })}
                    </p>
                    <h3 className="font-display mb-4 text-3xl font-normal leading-[1.08] tracking-tight text-foreground md:text-4xl">
                      {role.headline}
                      <br />
                      <span className="text-muted-foreground">{role.subhead}</span>
                    </h3>
                    <p className="mb-6 text-base leading-relaxed text-muted-foreground md:text-lg">
                      {role.body}
                    </p>
                    <ul className="mb-8 space-y-3">
                      {role.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm text-foreground/90">
                          <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', role.accent)} aria-hidden />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      className={cn(
                        'rounded-full px-6 font-semibold text-white shadow-md',
                        active === 'sme' && 'bg-brand-mid hover:bg-brand-dark',
                        active === 'investor' && 'bg-emerald-600 hover:bg-emerald-700',
                        active === 'supplier' && 'bg-amber-600 hover:bg-amber-700',
                      )}
                    >
                      <Link href={role.cta.href}>
                        {role.cta.label}
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                    <p className="mt-5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" aria-hidden />
                      {t('landing.roles.escrowNote')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p
            className={cn(
              'mt-8 text-center text-sm text-muted-foreground transition-opacity duration-700 delay-200',
              visible ? 'opacity-100' : 'opacity-0',
            )}
          >
            {t('landing.roles.footerLine')}
          </p>
        </div>
      </div>
    </section>
  )
}
