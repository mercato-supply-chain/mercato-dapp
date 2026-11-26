import { OurStoryView } from '@/components/our-story/our-story-view'
import { JsonLd } from '@/components/seo/json-ld'
import { languageAlternates } from '@/lib/i18n/config'

export async function generateMetadata() {
  return {
    title: 'Our Story | Mercato Supply Chain Finance',
    description:
      'Discover why Mercato was built: closing the supply chain financing gap for SMEs in Latin America through blockchain-secured escrow.',
    openGraph: {
      title: 'Our Story | Mercato',
      description: 'Closing the supply chain financing gap for SMEs in Latin America.',
      url: 'https://mercato.app/our-story',
      type: 'article',
    },
    alternates: {
      canonical: '/our-story',
      languages: languageAlternates('/our-story'),
    },
  }
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Our Story — Why Mercato Was Built',
  datePublished: '2025-01-01',
  dateModified: new Date().toISOString().split('T')[0],
  author: { '@type': 'Organization', name: 'Mercato' },
  publisher: { '@type': 'Organization', name: 'Mercato' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Mercato?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Mercato is a supply chain finance platform that helps SMEs in Latin America access working capital through blockchain-secured escrow, paying suppliers in milestones and settling in USDC on Stellar.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why was Mercato created?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Mercato was created to close the supply chain financing gap for small and medium businesses in Latin America who are excluded from traditional bank credit.',
      },
    },
    {
      '@type': 'Question',
      name: 'Who does Mercato serve?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Mercato serves three groups: PyMEs (buyers who need working capital), Suppliers (who need faster payment), and Investors (who want transparent deal-based returns).',
      },
    },
    {
      '@type': 'Question',
      name: 'How does Mercato work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A PyME creates a deal, splits supplier payment into milestones, investors fund the escrow, the supplier delivers in stages, and each milestone releases funds on-chain.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why does Mercato use blockchain escrow?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Blockchain escrow makes every fund movement transparent and auditable. No party can move money outside the agreed rules, which builds trust without requiring a bank as intermediary.',
      },
    },
  ],
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://mercato.app' },
    { '@type': 'ListItem', position: 2, name: 'Our Story', item: 'https://mercato.app/our-story' },
  ],
}

export default function OurStoryPage() {
  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbSchema} />
      <OurStoryView />
    </>
  )
}
