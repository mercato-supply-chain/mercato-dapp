import { Suspense } from 'react'
import { Navigation } from '@/components/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { InvestorsData } from './investors-data'
import { InvestorsSkeleton } from './investors-skeleton'

export async function generateMetadata() {
  return {
    title: 'Investor Directory | Mercato Supply Chain Finance',
    description: 'Explore the directory of active investors funding supply chain deals in Latin America on Mercato.',
    alternates: {
      canonical: '/investors',
      languages: {
        en: '/investors?lang=en',
        es: '/investors?lang=es',
      },
    },
  }
}

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://mercato.app"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Investors",
      "item": "https://mercato.app/investors"
    }
  ]
}

export default async function InvestorsPage() {
  const messages = await getServerDictionary()

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">
              {tr(messages, 'investorsPage.title')}
            </h1>
            <p className="text-muted-foreground">{tr(messages, 'investorsPage.subtitle')}</p>
          </div>
          <Suspense fallback={<InvestorsSkeleton />}>
            <InvestorsData />
          </Suspense>
        </div>
      </div>
    </>
  )
}
