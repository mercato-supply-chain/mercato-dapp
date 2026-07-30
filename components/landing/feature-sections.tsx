'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight, TrendingUp, ShieldCheck, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Intersection-observer hook ────────────────────────── */
function useReveal(threshold = 0.25) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Shared list-item component ────────────────────────── */
function FeatureItem({ text, color }: { text: string; color: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-muted-foreground">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} aria-hidden />
      {text}
    </li>
  )
}

/* ─── SME Mockup ─────────────────────────────────────────── */
function SMEMockup({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        'mockup-reveal overflow-hidden rounded-2xl shadow-2xl',
        visible && 'is-visible',
      )}
      style={{ background: '#fff', border: '1px solid #d1e7d8' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #e8f4ec', background: '#f2faf5' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#267046' }}>New purchase order</p>
        <p className="mt-0.5 font-bold text-slate-800">Step 2 of 3 — Supplier & Terms</p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Selected supplier</p>
          <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#f2faf5', border: '1px solid #c8e6d0' }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: '#1A4530' }}>AP</div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-800">Acero del Pacífico</p>
                <CheckCircle2 className="h-4 w-4" style={{ color: '#3FA068' }} />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="h-3 w-3" style={{ fill: '#f59e0b', color: '#f59e0b' }} />
                <p className="text-[10px] text-slate-500">4.8 · 156 orders · Steel & Metals</p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order amount</p>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-slate-400 font-medium">$</span>
            <span className="text-xl font-bold tabular-nums text-slate-800">48,500</span>
            <span className="ml-auto rounded-md px-2 py-1 text-[10px] font-semibold" style={{ background: '#e8f4ec', color: '#267046' }}>USDC</span>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment milestones</p>
          <div className="space-y-2">
            {[
              { label: 'On production start', pct: '50%', done: true },
              { label: 'On confirmed delivery', pct: '50%', done: false },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2')} style={{ borderColor: m.done ? '#267046' : '#cbd5e1', background: m.done ? '#267046' : 'transparent' }}>
                  {m.done && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                </div>
                <p className="flex-1 text-xs text-slate-600">{m.label}</p>
                <span className="text-xs font-bold text-slate-700">{m.pct}</span>
              </div>
            ))}
          </div>
        </div>
        <button className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ background: '#1A4530' }}>
          Deploy deal → open for investors
        </button>
      </div>
    </div>
  )
}

/* ─── Investor Mockup ───────────────────────────────────── */
function InvestorMockup({ visible }: { visible: boolean }) {
  const [animated, setAnimated] = React.useState(false)
  React.useEffect(() => {
    if (visible) { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t) }
  }, [visible])

  const deals = [
    { company: 'Industrias NOVA', cat: 'Steel Sheets', apr: '12.5%', days: 45, amt: '$48,500', pct: 100, status: 'Funded' },
    { company: 'GranoMex SA', cat: 'Premium Corn', apr: '10.2%', days: 30, amt: '$22,000', pct: 60, status: 'Open' },
    { company: 'TechParts MX', cat: 'Electronics', apr: '14.1%', days: 60, amt: '$91,200', pct: 35, status: 'Open' },
  ]

  return (
    <div
      className={cn('mockup-reveal overflow-hidden rounded-2xl shadow-2xl', visible && 'is-visible')}
      style={{ background: '#fff', border: '1px solid #d1e7d8' }}
    >
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #e8f4ec', background: '#f2faf5' }}>
        <div>
          <p className="font-bold text-slate-800">Active deals</p>
          <p className="text-[10px] text-slate-400">3 open · 1 funded</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: '#e8f4ec', border: '1px solid #c8e6d0' }}>
          <TrendingUp className="h-3.5 w-3.5" style={{ color: '#267046' }} />
          <span className="text-[11px] font-bold" style={{ color: '#1A4530' }}>Avg 12.3% APR</span>
        </div>
      </div>
      <div className="space-y-2.5 p-4">
        {deals.map((d, i) => (
          <div key={d.company} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
            <div className="mb-2.5 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{d.company}</p>
                <p className="text-[10px] text-slate-400">{d.cat} · {d.days}d term</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: '#267046' }}>{d.apr}</p>
                <p className="text-[10px] text-slate-400">APR</p>
              </div>
            </div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">{d.amt}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: d.status === 'Funded' ? '#e8f4ec' : '#f0fdf4', color: d.status === 'Funded' ? '#1A4530' : '#267046' }}>
                {d.status}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full" style={{ background: '#e8f4ec' }}>
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: animated ? `${d.pct}%` : '0%', background: d.status === 'Funded' ? '#3FA068' : '#267046', transitionDelay: `${i * 150}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Supplier Mockup ───────────────────────────────────── */
function SupplierMockup({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn('mockup-reveal overflow-hidden rounded-2xl shadow-2xl', visible && 'is-visible')}
      style={{ background: '#fff', border: '1px solid #d1e7d8' }}
    >
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #e8f4ec', background: '#f2faf5' }}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: '#1A4530' }}>AP</div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-slate-800">Acero del Pacífico</p>
            <ShieldCheck className="h-4 w-4" style={{ color: '#267046' }} />
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" style={{ fill: '#f59e0b', color: '#f59e0b' }} />
            <p className="text-[10px] text-slate-500">4.8 reputation · Verified supplier</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active order — PO #MKT-2847</p>
        {[
          { label: 'Milestone 1 — Production start', amount: '$24,250', status: 'paid', date: 'May 12' },
          { label: 'Milestone 2 — Delivery confirmed', amount: '$24,250', status: 'pending', date: 'Expected Jun 4' },
        ].map((m) => (
          <div key={m.label} className="rounded-xl p-3.5" style={{ background: m.status === 'paid' ? '#f2faf5' : '#f8fafc', border: `1px solid ${m.status === 'paid' ? '#c8e6d0' : '#e2e8f0'}` }}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">{m.label}</p>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: m.status === 'paid' ? '#e8f4ec' : '#f1f5f9', color: m.status === 'paid' ? '#1A4530' : '#64748b' }}>
                {m.status === 'paid' ? '✓ Paid' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold tabular-nums" style={{ color: m.status === 'paid' ? '#267046' : '#475569' }}>
                {m.amount}
              </p>
              <p className="text-[10px] text-slate-400">{m.date}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: '#fff8ed', border: '1px solid #fde68a' }}>
          <Star className="h-5 w-5 shrink-0" style={{ fill: '#f59e0b', color: '#f59e0b' }} />
          <div>
            <p className="text-xs font-bold text-amber-900">Reputation growing</p>
            <p className="text-[10px] text-amber-700">156 completed orders · Top 3% on Mercato</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Individual sticky section ─────────────────────────── */
interface FeatureSectionProps {
  id: string
  zIndex: number
  bg: string
  eyebrow: string
  eyebrowColor: string
  headline: React.ReactNode
  body: string
  bullets: string[]
  bulletColor: string
  ctaLabel: string
  ctaHref: string
  ctaStyle?: React.CSSProperties
  ctaVariant?: 'default' | 'outline'
  mockupSide: 'left' | 'right'
  Mockup: React.ComponentType<{ visible: boolean }>
}

function FeatureSection({
  id, zIndex, bg, eyebrow, eyebrowColor, headline, body, bullets, bulletColor,
  ctaLabel, ctaHref, ctaStyle, ctaVariant = 'default', mockupSide, Mockup,
}: FeatureSectionProps) {
  const { ref: textRef, visible: textVisible } = useReveal(0.2)
  const { ref: mockupRef, visible: mockupVisible } = useReveal(0.15)

  const text = (
    <div ref={textRef}>
      <div className={cn('stagger-reveal', textVisible && 'is-visible')}>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: eyebrowColor }}>
          {eyebrow}
        </p>
        <h2 className="font-display mb-5 text-4xl font-normal tracking-tight text-foreground md:text-[2.75rem] leading-[1.1] text-balance">
          {headline}
        </h2>
        <p className="mb-7 text-lg leading-relaxed text-muted-foreground">{body}</p>
        <ul className="mb-8 space-y-3">
          {bullets.map((b) => <FeatureItem key={b} text={b} color={bulletColor} />)}
        </ul>
        <Button
          asChild
          variant={ctaVariant}
          className="rounded-full"
          style={ctaStyle}
        >
          <Link href={ctaHref}>
            {ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  )

  const mockup = (
    <div ref={mockupRef} className={mockupSide === 'left' ? 'lg:pr-6' : 'lg:pl-6'}>
      <Mockup visible={mockupVisible} />
    </div>
  )

  return (
    <section
      id={id}
      className="sticky-card-reveal sticky top-0 overflow-hidden"
      style={{ zIndex, background: bg }}
    >
      <div className="container mx-auto px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            {mockupSide === 'left' ? (
              <>
                {mockup}
                {text}
              </>
            ) : (
              <>
                {text}
                {mockup}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Exported wrapper ───────────────────────────────────── */
export function FeatureSections() {
  return (
    <div>
      <FeatureSection
        id="for-smes"
        zIndex={10}
        bg="hsl(var(--feat-1-bg))"
        eyebrow="For SMEs"
        eyebrowColor="#267046"
        headline={<>Stop waiting on capital.<br /><span className="text-muted-foreground">Start shipping.</span></>}
        body="Create a purchase order, pick a verified supplier, set your milestones — and have your order funded by investors within hours. No banks, no credit checks, no 60-day cycles."
        bullets={[
          'Access working capital on demand',
          'Build a verifiable on-chain track record',
          'Pay investors only after you sell the goods',
        ]}
        bulletColor="#267046"
        ctaLabel="Create your first deal"
        ctaHref="/auth/sign-up"
        ctaStyle={{ background: '#1A4530', color: '#fff', border: 'none' }}
        mockupSide="right"
        Mockup={SMEMockup}
      />

      <FeatureSection
        id="for-investors"
        zIndex={20}
        bg="hsl(var(--feat-2-bg))"
        eyebrow="For Investors"
        eyebrowColor="#267046"
        headline={<>Capital that moves<br /><span className="text-muted-foreground">with real goods.</span></>}
        body="Fund verified purchase orders and earn 8–15% APR. Your capital is tied to real economic activity — goods that move, milestones that are confirmed, and SMEs with skin in the game."
        bullets={[
          '8–15% APR on 30–90 day terms',
          'See exactly what your capital is funding',
          'Milestone-secured — capital protected until delivery',
        ]}
        bulletColor="#267046"
        ctaLabel="Browse open deals"
        ctaHref="/deals"
        ctaVariant="outline"
        ctaStyle={{ borderColor: '#267046', color: '#267046' }}
        mockupSide="left"
        Mockup={InvestorMockup}
      />

      <FeatureSection
        id="for-suppliers"
        zIndex={30}
        bg="hsl(var(--feat-3-bg))"
        eyebrow="For Suppliers"
        eyebrowColor="#267046"
        headline={<>Get paid as<br /><span className="text-muted-foreground">you deliver.</span></>}
        body="No more net-60 payment terms. Funds are locked in before you start production, and released to you at every confirmed milestone — on shipment, on delivery."
        bullets={[
          'Payment secured before production starts',
          'Build a verified reputation with each order',
          'Grow with repeat SME buyers on Mercato',
        ]}
        bulletColor="#267046"
        ctaLabel="See verified suppliers"
        ctaHref="/suppliers"
        ctaVariant="outline"
        ctaStyle={{ borderColor: '#267046', color: '#267046' }}
        mockupSide="right"
        Mockup={SupplierMockup}
      />
    </div>
  )
}
