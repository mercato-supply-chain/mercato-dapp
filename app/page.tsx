import { Suspense } from 'react'
import { Navigation } from '@/components/navigation'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingHeroDeal } from '@/components/landing/landing-hero-deal'
import { LandingRoles } from '@/components/landing/landing-roles'
import { LandingRateComparison } from '@/components/landing/landing-rate-comparison'
import { LandingLiveDeals } from '@/components/landing/landing-live-deals'
import { LandingFaq } from '@/components/landing/landing-faq'
import { LandingPartnersStrip } from '@/components/landing/landing-page-intro'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingHashScroll } from '@/components/landing/landing-hash-scroll'
import { JsonLd } from '@/components/seo/json-ld'
import { HeroHowItWorksSteps } from '@/components/landing/hero-how-it-works-steps'
import { LANDING_SECTION_IDS } from '@/lib/navigation/landing-nav'
import { languageAlternates } from '@/lib/i18n/config'

export async function generateMetadata() {
  return {
    title: 'MERCATO — Supply Chain Finance Platform',
    description: 'Connect PyMEs, investors, and suppliers through transparent, blockchain-secured escrow for supply chain financing in Latin America.',
    alternates: {
      canonical: '/',
      languages: languageAlternates('/'),
    },
  }
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  'itemListElement': [
    {
      '@type': 'ListItem',
      'position': 1,
      'name': 'Home',
      'item': 'https://mercato.app',
    },
  ],
}

function HowItWorksFallback() {
  return <div className="h-[27rem] w-full lg:h-[25rem]" aria-hidden />
}

function HeroOrderFallback() {
  return <div className="min-h-[21rem] rounded-2xl border border-border bg-card" aria-hidden />
}

function LiveDealsFallback() {
  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-8 h-24 rounded bg-muted/40" />
        <div className="space-y-0 border-t border-border">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-28 border-b border-border bg-muted/20" />
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <JsonLd data={breadcrumbSchema} />
      <Navigation overHero />
      <LandingHashScroll />

      <main id="main" tabIndex={-1} className="flex-1">
        <LandingHero
          orderPreview={
            <Suspense fallback={<HeroOrderFallback />}>
              <LandingHeroDeal />
            </Suspense>
          }
        />

        <section
          id={LANDING_SECTION_IDS.howItWorks}
          aria-labelledby="landing-flow-title"
          className="landing-section-anchor border-y border-border bg-[#f5f9f6] dark:bg-[#101511]"
        >
          <Suspense fallback={<HowItWorksFallback />}>
            <HeroHowItWorksSteps />
          </Suspense>
        </section>

        <LandingRoles />

        <LandingRateComparison />

        <Suspense fallback={<LiveDealsFallback />}>
          <LandingLiveDeals />
        </Suspense>

        <LandingFaq />

        <LandingPartnersStrip />
      </main>

      <LandingFooter />
    </div>
  )
}
