import { fetchPublicSuppliers } from '@/lib/suppliers/directory'
import SuppliersDirectory from './suppliers-directory'
import { JsonLd } from '@/components/seo/json-ld'

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
  const suppliers = await fetchPublicSuppliers()

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <SuppliersDirectory initialSuppliers={suppliers} />
    </>
  )
}
