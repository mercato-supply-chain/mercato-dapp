import { notFound } from 'next/navigation'
import { getDealSummary } from '@/lib/deals/detail'
import DealDetailPageClient from './deal-detail-view'
import { JsonLd } from '@/components/seo/json-ld'
import { languageAlternates } from '@/lib/i18n/config'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const dbDeal = await getDealSummary(id)

  if (!dbDeal) {
    return {
      title: 'Deal Not Found | Mercato',
    }
  }

  const dealName = dbDeal.product_name || dbDeal.title || 'Supply Chain Deal'
  const pymeName = dbDeal.pyme?.company_name || dbDeal.pyme?.full_name || dbDeal.pyme?.contact_name || 'PyME'
  const desc = dbDeal.description || `Supply chain finance deal on Mercato: ${dealName} for ${pymeName}.`

  return {
    title: `${dealName} | Mercato Deals`,
    description: desc,
    openGraph: {
      title: `${dealName} | Mercato`,
      description: desc,
      type: 'website',
    },
    alternates: {
      canonical: `/deals/${id}`,
      languages: languageAlternates(`/deals/${id}`),
    },
  }
}

export default async function DealDetailPage({ params }: PageProps) {
  const { id } = await params
  const dbDeal = await getDealSummary(id)

  if (!dbDeal) {
    notFound()
  }

  const displayName = dbDeal.product_name || dbDeal.title || 'Deal Detail'

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
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Deals',
        'item': 'https://mercato.app/deals',
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': displayName,
        'item': `https://mercato.app/deals/${dbDeal.id}`,
      },
    ],
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <DealDetailPageClient initialDeal={dbDeal.deal} />
    </>
  )
}
