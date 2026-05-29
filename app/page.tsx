import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingRoles } from '@/components/landing/landing-roles'
import { LandingRateComparison } from '@/components/landing/landing-rate-comparison'
import { LandingLiveDeals } from '@/components/landing/landing-live-deals'
import { LandingFaq } from '@/components/landing/landing-faq'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingHashScroll } from '@/components/landing/landing-hash-scroll'
import { JsonLd } from '@/components/seo/json-ld'

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

export default async function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <JsonLd data={breadcrumbSchema} />
      <Navigation />
      <LandingHashScroll />

      <LandingHero />

      <LandingRoles />

      <LandingRateComparison />

      <div className="flex flex-col items-center py-12 border-t border-border/50">
        <p className="text-muted-foreground mb-3">Want to understand the full picture?</p>
       <Link href="/our-story" className="text-primary font-medium underline underline-offset-4">
  Learn our story →
</Link>
      </div>

      <section className="border-t border-border/50 bg-background">
        <LandingLiveDeals />
      </section>

      <LandingFaq />

      <LandingFooter />
    </div>
  )
}