import { Suspense } from 'react'
import { Navigation } from '@/components/navigation'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingRoles } from '@/components/landing/landing-roles'
import { LandingRateComparison } from '@/components/landing/landing-rate-comparison'
import { LandingLiveDeals } from '@/components/landing/landing-live-deals'
import { LandingFaq } from '@/components/landing/landing-faq'
import { LandingPartnersStrip } from '@/components/landing/landing-page-intro'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingHashScroll } from '@/components/landing/landing-hash-scroll'
import { JsonLd } from '@/components/seo/json-ld'
import { LandingStats } from '@/components/landing/landing-stats'
import { HeroStatsBar } from '@/components/landing/hero-stats-bar'
import { LandingHeroDeal } from '@/components/landing/landing-hero-deal'
import { HeroDealSheet } from '@/components/landing/hero-deal-sheet'
import { sampleHeroDeal } from '@/lib/landing/hero-deal'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return {
    title: 'MERCATO — Supply Chain Finance Platform',
    description: 'Connect PyMEs, investors, and suppliers through transparent, blockchain-secured escrow for supply chain financing in Latin America.',
    alternates: {
      canonical: '/',
      languages: {
        en: '/?lang=en',
        es: '/?lang=es',
      },
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

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <JsonLd data={breadcrumbSchema} />
      <Navigation overHero />
      <LandingHashScroll />

      <main id="main" tabIndex={-1} className="flex-1">
        <LandingHero
          deal={
            <Suspense
              fallback={
                <HeroDealSheet
                  deal={sampleHeroDeal()}
                  className="hero-stagger-4 w-full lg:justify-self-end"
                />
              }
            >
              <LandingHeroDeal />
            </Suspense>
          }
          stats={
            <Suspense fallback={<HeroStatsBar />}>
              <LandingStats />
            </Suspense>
          }
        />

        <LandingRoles />

        <LandingRateComparison />

        <section className="border-t border-border/50 bg-background">
          <LandingLiveDeals />
        </section>

        <LandingFaq />

        <LandingPartnersStrip />
      </main>

      <LandingFooter />
    </div>
  )
}