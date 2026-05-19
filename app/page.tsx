import { Navigation } from '@/components/navigation'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingRoles } from '@/components/landing/landing-roles'
import { LandingRateComparison } from '@/components/landing/landing-rate-comparison'
import { OrderFlow } from '@/components/landing/order-flow'
import { LandingCta } from '@/components/landing/landing-cta'
import { LandingLiveDeals } from '@/components/landing/landing-live-deals'
import { LandingFaq } from '@/components/landing/landing-faq'
import { LandingFooter } from '@/components/landing/landing-footer'
import { ScrollReveal } from '@/components/landing/scroll-reveal'

export default async function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <Navigation />

      <LandingHero />

      <LandingRoles />

      <LandingRateComparison />

      <section className="relative overflow-hidden bg-background py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(var(--brand-pale)/0.5),transparent)] dark:bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(0_0%_100%/0.03),transparent)]" aria-hidden />
        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal className="mb-14 text-center md:mb-16">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-mid">
                How it works
              </p>
              <h2 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-normal leading-[1.05] tracking-tight text-foreground text-balance">
                From order to delivery,
                <br />
                <span className="text-muted-foreground">five clear steps.</span>
              </h2>
            </ScrollReveal>
            <OrderFlow />
          </div>
        </div>
      </section>

      <ScrollReveal as="section" className="border-t border-border/40 bg-brand-ultra/50 py-12 dark:bg-muted/10" delay={100}>
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <p className="mb-8 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-mid/60">
              Built with the Stellar ecosystem
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
              <a
                href="https://trustlesswork.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 opacity-50 transition-all duration-300 hover:opacity-100 hover:scale-105"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/trustless-work-logo.png" alt="" width={28} height={28} className="h-7 w-auto object-contain" />
                <span className="text-sm font-semibold text-foreground/70 group-hover:text-foreground">Trustless Work</span>
              </a>
              <a
                href="https://etherfuse.com"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-50 transition-all duration-300 hover:opacity-100 hover:scale-105"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/etherfuse-logo.svg" alt="Etherfuse" height={24} className="h-6 w-auto object-contain dark:invert" />
              </a>
              <a
                href="https://defindex.io"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-50 transition-all duration-300 hover:opacity-100 hover:scale-105"
              >
                <span className="flex items-center rounded-lg bg-brand-dark px-3 py-1.5 dark:bg-transparent dark:px-0 dark:py-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/defindex-logo.svg" alt="DeFindex" height={28} className="h-7 w-auto object-contain" />
                </span>
              </a>
            </div>
          </div>
        </div>
      </ScrollReveal>

      <LandingCta />

      <section className="border-t border-border/50 bg-background">
        <LandingLiveDeals />
      </section>

      <LandingFaq />

      <LandingFooter />
    </div>
  )
}
