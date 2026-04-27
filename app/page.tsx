import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Navigation } from '@/components/navigation'
import { HeroDealsCarousel } from '@/components/landing/hero-deals-carousel'
import { MercatoLogo } from '@/components/mercato-logo'
import { cn } from '@/lib/utils'
import {
  Boxes,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Lock,
  Truck,
  DollarSign,
  RotateCcw,
  CheckCircle2,
  Wallet2,
  Eye,
  Coins,
  ArrowLeftRight,
} from 'lucide-react'
import { getServerDictionary } from '@/lib/i18n/server'

/** Deal cycle: one-shot enter, transform + opacity only, skipped under reduced motion */
const cycleHeaderEnter =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-out motion-safe:fill-mode-both'
const cycleStepEnter =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:zoom-in-[0.98] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:fill-mode-backwards'
const cycleArrowEnter =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-400 motion-safe:ease-out motion-safe:fill-mode-backwards'
const cycleHubEnter =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-600 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:fill-mode-backwards'

const cycleCardHover =
  'group transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-colors motion-reduce:hover:translate-y-0 active:translate-y-0 active:scale-[0.995] motion-reduce:active:scale-100'
const cycleIconWrapHover =
  'transition-transform duration-200 ease-out group-hover:scale-[1.06] motion-reduce:group-hover:scale-100'

/** Looped pulse + nudge on cycle arrows; phase delays chase 1→2→3→4→1 (4s loop, 1s per quadrant) */
const cycleArrowLoopStaggerMs = 1000
const cycleArrowLoopWrap =
  'inline-flex rounded-full p-1.5 text-accent motion-reduce:animate-none'
const cycleArrowLoopRight = cn(cycleArrowLoopWrap, 'motion-safe:animate-mercato-flow-right')
const cycleArrowLoopDown = cn(cycleArrowLoopWrap, 'motion-safe:animate-mercato-flow-down')
const cycleArrowLoopLeft = cn(cycleArrowLoopWrap, 'motion-safe:animate-mercato-flow-left')
const cycleArrowLoopUp = cn(cycleArrowLoopWrap, 'motion-safe:animate-mercato-flow-up')

/** Step number badge pulse, one at a time per 4s (aligned with deal-cycle arrow loop). */
function cycleStepBadgePulseClass(step: number) {
  return cn(
    'origin-center motion-reduce:animate-none',
    step === 1 && 'motion-safe:animate-mercato-cycle-step-1',
    step === 2 && 'motion-safe:animate-mercato-cycle-step-2',
    step === 3 && 'motion-safe:animate-mercato-cycle-step-3',
    step === 4 && 'motion-safe:animate-mercato-cycle-step-4',
  )
}

/** Whole step card pulse, same 4s phases as badges/arrows; gentler scale on the card. */
function cycleCardPulseClass(step: number) {
  return cn(
    'origin-center motion-reduce:animate-none',
    step === 1 && 'motion-safe:animate-mercato-cycle-card-1',
    step === 2 && 'motion-safe:animate-mercato-cycle-card-2',
    step === 3 && 'motion-safe:animate-mercato-cycle-card-3',
    step === 4 && 'motion-safe:animate-mercato-cycle-card-4',
  )
}

export default async function HomePage() {
  const t = await getServerDictionary()

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-success/5"
          aria-hidden
        />
        <div className="container relative mx-auto px-4">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">

            {/* Left: headline + CTAs + trust signals */}
            <div className="flex-1 pt-2 text-center lg:text-left">
              <Badge
                className="mb-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both"
                variant="secondary"
              >
                {t.home.badge}
              </Badge>
              <h1 className="mb-5 text-4xl font-bold tracking-tight text-balance motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:delay-75 motion-safe:fill-mode-both md:text-5xl lg:text-6xl">
                {t.home.titlePrefix}{' '}
                <span className="text-accent">{t.home.titleAccent}</span>
              </h1>
              <p className="mb-8 max-w-xl text-lg text-muted-foreground text-balance motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:delay-150 motion-safe:fill-mode-both">
                {t.home.description}
              </p>
              <div className="flex flex-col items-center justify-center gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:delay-200 motion-safe:fill-mode-both sm:flex-row lg:justify-start">
                <Button size="lg" asChild>
                  <Link href="/auth/sign-up">
                    {t.home.primaryCta}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/deals">{t.home.secondaryCta}</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  {t.home.trustEscrow}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  {t.home.trustUsdc}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  {t.home.trustTerms}
                </span>
              </div>
            </div>

            {/* Right: illustrative deals carousel (one slide at a time) */}
            <HeroDealsCarousel />

          </div>
        </div>
      </section>

      {/* Deal Cycle Section */}
      <section
        className="container mx-auto px-4 py-16"
        aria-labelledby="deal-cycle-heading"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <Badge variant="secondary" className={cn('mb-4', cycleHeaderEnter)}>
              The deal cycle
            </Badge>
            <h2
              id="deal-cycle-heading"
              className={cn(
                'mb-3 text-3xl font-bold tracking-tight',
                cycleHeaderEnter,
                'motion-safe:delay-75',
              )}
            >
              From order to repayment
            </h2>
            <p
              className={cn(
                'text-muted-foreground',
                cycleHeaderEnter,
                'motion-safe:delay-150',
              )}
            >
              Four roles, one transparent loop — secured by Stellar escrow at every step.
            </p>
          </div>

          {/* Mobile: vertical flow */}
          <div className="flex flex-col items-stretch gap-3 md:hidden">
            {[
              {
                step: 1,
                role: 'PyME · Buyer',
                title: 'Creates the deal',
                body: 'Selects a supplier, sets the order amount, defines payment milestones, and deploys a non-custodial escrow on Stellar.',
                icon: Boxes,
                color: 'accent',
              },
              {
                step: 2,
                role: 'Investor',
                title: 'Funds the escrow',
                body: 'Browses open deals, chooses one, and sends USDC directly into the smart contract. Funds are locked until milestones are approved.',
                icon: DollarSign,
                color: 'success',
              },
              {
                step: 3,
                role: 'Supplier',
                title: 'Ships & gets paid',
                body: 'Ships the goods and uploads delivery proof on-chain. Escrow releases USDC in milestones upon PyME approval.',
                icon: Truck,
                color: 'primary',
              },
              {
                step: 4,
                role: 'PyME · Buyer',
                title: 'Repays investors',
                body: 'After selling the inventory, the PyME repays principal plus yield (8–15% APR). The cycle completes on-chain.',
                icon: RotateCcw,
                color: 'accent',
              },
            ].map(({ step, role, title, body, icon: Icon, color }, idx, arr) => (
              <div key={step}>
                <div
                  style={{ animationDelay: `${idx * 95}ms` }}
                  className={cn(cycleStepEnter, 'min-w-0')}
                >
                  <div
                    className={cn(
                      'flex gap-4 rounded-2xl border-2 p-5',
                      cycleCardHover,
                      cycleCardPulseClass(step),
                      color === 'accent' &&
                        'border-accent/30 bg-accent/5 hover:border-accent/55 hover:bg-accent/10 hover:shadow-accent/10',
                      color === 'success' &&
                        'border-success/30 bg-success/5 hover:border-success/55 hover:bg-success/10 hover:shadow-success/10',
                      color === 'primary' &&
                        'border-primary/30 bg-primary/5 hover:border-primary/55 hover:bg-primary/10 hover:shadow-primary/10',
                    )}
                  >
                  <div className="shrink-0">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                        cycleStepBadgePulseClass(step),
                        color === 'accent' && 'bg-accent text-accent-foreground',
                        color === 'success' && 'bg-success text-success-foreground',
                        color === 'primary' && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {step}
                    </span>
                    <div
                      className={cn(
                        'mt-2 flex h-10 w-10 items-center justify-center rounded-xl',
                        cycleIconWrapHover,
                        color === 'accent' && 'bg-accent/15',
                        color === 'success' && 'bg-success/15',
                        color === 'primary' && 'bg-primary/15',
                      )}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          color === 'accent'
                            ? 'text-accent'
                            : color === 'success'
                              ? 'text-success'
                              : 'text-primary'
                        }`}
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div>
                    <p
                      className={`mb-0.5 text-xs font-semibold uppercase tracking-wider ${
                        color === 'accent'
                          ? 'text-accent'
                          : color === 'success'
                            ? 'text-success'
                            : 'text-primary'
                      }`}
                    >
                      {role}
                    </p>
                    <h3 className="mb-1 font-bold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{body}</p>
                  </div>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div
                    className={cn(
                      'flex justify-center py-1',
                      cycleArrowEnter,
                      'motion-safe:slide-in-from-top-1',
                    )}
                    style={{ animationDelay: `${idx * 95 + 70}ms` }}
                  >
                    <span
                      aria-hidden
                      className={cycleArrowLoopDown}
                      style={{
                        animationDelay: `${idx * cycleArrowLoopStaggerMs}ms`,
                      }}
                    >
                      <ArrowDown className="h-5 w-5 shrink-0" aria-hidden />
                    </span>
                  </div>
                )}
              </div>
            ))}
            <div
              className={cn(
                'mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground',
                cycleArrowEnter,
                'motion-safe:delay-500',
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Cycle repeats with the next deal
            </div>
          </div>

          {/* Desktop: 2×2 cycle grid — delays follow flow 1 → 2 → hub → 3 → 4 → loop */}
          <div
            className="hidden md:grid"
            style={{ gridTemplateColumns: '1fr 5rem 1fr', gridTemplateRows: 'auto 5rem auto' }}
          >
            {/* ── Step 1 — top-left ── */}
            <div style={{ animationDelay: '0ms' }} className={cn(cycleStepEnter, 'min-w-0')}>
              <div
                className={cn(
                  'flex gap-4 rounded-2xl border-2 border-accent/30 bg-accent/5 p-6',
                  cycleCardHover,
                  cycleCardPulseClass(1),
                  'hover:border-accent/55 hover:bg-accent/10 hover:shadow-accent/10',
                )}
              >
              <div className="shrink-0">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground',
                    cycleStepBadgePulseClass(1),
                  )}
                >
                  1
                </span>
                <div
                  className={cn(
                    'mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15',
                    cycleIconWrapHover,
                  )}
                >
                  <Boxes className="h-5 w-5 text-accent" aria-hidden />
                </div>
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-accent">PyME · Buyer</p>
                <h3 className="mb-1 font-bold">Creates the deal</h3>
                <p className="text-sm text-muted-foreground">
                  Picks a supplier, sets the order amount, defines payment milestones, and deploys a non-custodial escrow on Stellar.
                </p>
              </div>
              </div>
            </div>

            {/* ── Arrow right (1 → 2) ── */}
            <div
              style={{ animationDelay: '90ms' }}
              className={cn(
                'flex items-center justify-center',
                cycleArrowEnter,
                'motion-safe:slide-in-from-left-3',
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <span
                  aria-hidden
                  className={cycleArrowLoopRight}
                  style={{ animationDelay: '0ms' }}
                >
                  <ArrowRight className="h-6 w-6 shrink-0" aria-hidden />
                </span>
              </div>
            </div>

            {/* ── Step 2 — top-right ── */}
            <div style={{ animationDelay: '160ms' }} className={cn(cycleStepEnter, 'min-w-0')}>
              <div
                className={cn(
                  'flex gap-4 rounded-2xl border-2 border-success/30 bg-success/5 p-6',
                  cycleCardHover,
                  cycleCardPulseClass(2),
                  'hover:border-success/55 hover:bg-success/10 hover:shadow-success/10',
                )}
              >
              <div className="shrink-0">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground',
                    cycleStepBadgePulseClass(2),
                  )}
                >
                  2
                </span>
                <div
                  className={cn(
                    'mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-success/15',
                    cycleIconWrapHover,
                  )}
                >
                  <DollarSign className="h-5 w-5 text-success" aria-hidden />
                </div>
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-success">Investor</p>
                <h3 className="mb-1 font-bold">Funds the escrow</h3>
                <p className="text-sm text-muted-foreground">
                  Browses open deals, chooses one, and sends USDC directly into the smart contract. Funds are locked until milestones are approved.
                </p>
              </div>
              </div>
            </div>

            {/* ── Arrow up (4 → 1, closes loop) — middle-left ── */}
            <div
              style={{ animationDelay: '700ms' }}
              className={cn(
                'flex items-center justify-center',
                cycleArrowEnter,
                'motion-safe:slide-in-from-bottom-3',
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <span
                  aria-hidden
                  className={cycleArrowLoopUp}
                  style={{
                    animationDelay: `${3 * cycleArrowLoopStaggerMs}ms`,
                  }}
                >
                  <ArrowUp className="h-6 w-6 shrink-0" aria-hidden />
                </span>
                <span className="text-center text-[10px] leading-tight text-muted-foreground/60">
                  next
                  <br />
                  deal
                </span>
              </div>
            </div>

            {/* ── Center: Escrow hub ── */}
            <div
              style={{ animationDelay: '260ms' }}
              className={cn(
                'group/cyclehub flex flex-col items-center justify-center gap-2',
                cycleHubEnter,
              )}
            >
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background shadow-sm',
                  'transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out',
                  'group-hover/cyclehub:-translate-y-0.5 group-hover/cyclehub:scale-105 group-hover/cyclehub:border-accent/45 group-hover/cyclehub:bg-accent/5 group-hover/cyclehub:shadow-md',
                  'motion-reduce:group-hover/cyclehub:translate-y-0 motion-reduce:group-hover/cyclehub:scale-100',
                )}
              >
                <Lock
                  className="h-6 w-6 text-muted-foreground transition-colors duration-200 group-hover/cyclehub:text-accent motion-reduce:group-hover/cyclehub:text-muted-foreground"
                  aria-hidden
                />
              </div>
              <span className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Escrow
              </span>
            </div>

            {/* ── Arrow down (2 → 3) — middle-right ── */}
            <div
              style={{ animationDelay: '340ms' }}
              className={cn(
                'flex items-center justify-center',
                cycleArrowEnter,
                'motion-safe:slide-in-from-top-3',
              )}
            >
              <span
                aria-hidden
                className={cycleArrowLoopDown}
                style={{
                  animationDelay: `${1 * cycleArrowLoopStaggerMs}ms`,
                }}
              >
                <ArrowDown className="h-6 w-6 shrink-0" aria-hidden />
              </span>
            </div>

            {/* ── Step 4 — bottom-left ── */}
            <div style={{ animationDelay: '600ms' }} className={cn(cycleStepEnter, 'min-w-0')}>
              <div
                className={cn(
                  'flex gap-4 rounded-2xl border-2 border-accent/30 bg-accent/5 p-6',
                  cycleCardHover,
                  cycleCardPulseClass(4),
                  'hover:border-accent/55 hover:bg-accent/10 hover:shadow-accent/10',
                )}
              >
              <div className="shrink-0">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground',
                    cycleStepBadgePulseClass(4),
                  )}
                >
                  4
                </span>
                <div
                  className={cn(
                    'mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15',
                    cycleIconWrapHover,
                  )}
                >
                  <RotateCcw className="h-5 w-5 text-accent" aria-hidden />
                </div>
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-accent">PyME · Buyer</p>
                <h3 className="mb-1 font-bold">Repays investors</h3>
                <p className="text-sm text-muted-foreground">
                  After selling the inventory, the PyME repays principal plus yield (8–15% APR). The cycle completes transparently on-chain.
                </p>
              </div>
              </div>
            </div>

            {/* ── Arrow left (3 → 4) — bottom-center ── */}
            <div
              style={{ animationDelay: '520ms' }}
              className={cn(
                'flex items-center justify-center',
                cycleArrowEnter,
                'motion-safe:slide-in-from-right-3',
              )}
            >
              <span
                aria-hidden
                className={cycleArrowLoopLeft}
                style={{
                  animationDelay: `${2 * cycleArrowLoopStaggerMs}ms`,
                }}
              >
                <ArrowLeft className="h-6 w-6 shrink-0" aria-hidden />
              </span>
            </div>

            {/* ── Step 3 — bottom-right ── */}
            <div style={{ animationDelay: '420ms' }} className={cn(cycleStepEnter, 'min-w-0')}>
              <div
                className={cn(
                  'flex gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-6',
                  cycleCardHover,
                  cycleCardPulseClass(3),
                  'hover:border-primary/55 hover:bg-primary/10 hover:shadow-primary/10',
                )}
              >
              <div className="shrink-0">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground',
                    cycleStepBadgePulseClass(3),
                  )}
                >
                  3
                </span>
                <div
                  className={cn(
                    'mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15',
                    cycleIconWrapHover,
                  )}
                >
                  <Truck className="h-5 w-5 text-primary" aria-hidden />
                </div>
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-primary">Supplier</p>
                <h3 className="mb-1 font-bold">Ships & gets paid</h3>
                <p className="text-sm text-muted-foreground">
                  Ships goods and uploads delivery proof on-chain. Escrow releases USDC in milestones upon PyME approval.
                </p>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="border-y border-border bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold tracking-tight">Built on trust & transparency</h2>
              <p className="text-muted-foreground">
                Non-custodial, on-chain, and auditable — every step of the deal cycle.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-sm motion-reduce:transition-colors motion-reduce:hover:translate-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Lock className="h-5 w-5 text-accent" aria-hidden />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Non-custodial escrow</h3>
                  <p className="text-sm text-muted-foreground">
                    Funds go directly into a Stellar smart contract via Trustless Work. MERCATO never touches investor capital — only the contract logic authorizes a release.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-success/25 hover:shadow-sm motion-reduce:transition-colors motion-reduce:hover:translate-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Milestone-based payments</h3>
                  <p className="text-sm text-muted-foreground">
                    Suppliers receive USDC in stages as milestones are approved — no waiting on net-30/60 terms. Investors get repaid at the end of the deal term with full yield.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm motion-reduce:transition-colors motion-reduce:hover:translate-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet2 className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Wallet-signed transactions</h3>
                  <p className="text-sm text-muted-foreground">
                    Every escrow deployment, funding, and milestone release requires a signature from your Stellar wallet (Freighter or Albedo). You stay in control at every step.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-sm motion-reduce:transition-colors motion-reduce:hover:translate-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Eye className="h-5 w-5 text-accent" aria-hidden />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Full on-chain proof</h3>
                  <p className="text-sm text-muted-foreground">
                    Every payment, milestone approval, and delivery confirmation is recorded on Stellar — verifiable by anyone, at any time, without trusting MERCATO.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-success/25 hover:shadow-sm motion-reduce:transition-colors motion-reduce:hover:translate-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Coins className="h-5 w-5 text-success" aria-hidden />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">USDC denominated</h3>
                  <p className="text-sm text-muted-foreground">
                    All deals are denominated in USDC on Stellar — a stable, dollar-pegged asset. Investors earn 8–15% APR with no crypto-volatility exposure.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm motion-reduce:transition-colors motion-reduce:hover:translate-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ArrowLeftRight className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">Fiat on/off ramps</h3>
                  <p className="text-sm text-muted-foreground">
                    Convert between local currency and USDC within the app via Etherfuse (Mexico, SPEI), Alfred Pay (LATAM), or BlindPay (global) — no third-party exchange needed.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <MercatoLogo className="h-5 dark:invert" />
              <span className="font-semibold">MERCATO</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 MERCATO. Supply Chain Finance on Stellar.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
