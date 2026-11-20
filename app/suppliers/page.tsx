import { Suspense } from 'react'
import { Building2 } from 'lucide-react'
import { Navigation } from '@/components/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { SuppliersData } from './suppliers-data'
import { SuppliersSkeleton } from './suppliers-skeleton'

export async function generateMetadata() {
  return {
    title: 'Supplier Directory | Mercato Supply Chain Finance',
    description:
      'Browse verified suppliers across Latin America. Connect suppliers to deals for milestone-based payments secured by escrow.',
    alternates: {
      canonical: '/suppliers',
      languages: {
        en: '/suppliers?lang=en',
        es: '/suppliers?lang=es',
      },
    },
  }
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://mercato.app',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Suppliers',
      item: 'https://mercato.app/suppliers',
    },
  ],
}

export default async function SuppliersPage() {
  const messages = await getServerDictionary()

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <div className="container mx-auto px-4 py-10">
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
              <Building2 className="h-3 w-3" aria-hidden />
              {tr(messages, 'suppliersPage.eyebrow')}
            </div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">
              {tr(messages, 'suppliersPage.title')}
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              {tr(messages, 'suppliersPage.description')}
            </p>
          </div>
          <Suspense fallback={<SuppliersSkeleton />}>
            <SuppliersData />
          </Suspense>
        </div>
      </div>
    </>
  )
}
