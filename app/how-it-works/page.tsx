import { HowItWorksView } from './how-it-works-view'
import { JsonLd } from '@/components/seo/json-ld'
import { languageAlternates } from '@/lib/i18n/config'

export async function generateMetadata() {
  return {
    title: 'How It Works | Mercato Supply Chain Finance',
    description: 'Learn how Mercato connects SMBs, investors, and suppliers through transparent, blockchain-secured escrows on Stellar.',
    openGraph: {
      title: 'How It Works | Mercato',
      description: 'Step-by-step guide to blockchain-secured supply chain financing.',
      url: 'https://mercato.app/how-it-works',
      type: 'website',
    },
    alternates: {
      canonical: '/how-it-works',
      languages: languageAlternates('/how-it-works'),
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
    {
      '@type': 'ListItem',
      'position': 2,
      'name': 'How It Works',
      'item': 'https://mercato.app/how-it-works',
    },
  ],
}

const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  'name': 'How to Use Mercato for Supply Chain Finance',
  'description': 'A step-by-step guide to setting up, funding, fulfilling, and repaying supply chain deals on Mercato.',
  'step': [
    {
      '@type': 'HowToStep',
      'position': 1,
      'name': 'SMB Creates Deal & Deploys Escrow',
      'text': 'An SMB selects a supplier and product from the catalog, defines payment milestones, and signs a transaction to deploy a non-custodial escrow contract on Stellar.',
      'url': 'https://mercato.app/how-it-works',
    },
    {
      '@type': 'HowToStep',
      'position': 2,
      'name': 'Investor Funds the Escrow',
      'text': 'An investor reviews the open deal and commits USDC directly to the escrow contract from their non-custodial Stellar wallet.',
      'url': 'https://mercato.app/how-it-works',
    },
    {
      '@type': 'HowToStep',
      'position': 3,
      'name': 'Supplier Ships & Milestones Release',
      'text': 'The supplier ships goods and uploads proof. A milestone approval by the SMB triggers on-chain release of USDC from the escrow to the supplier.',
      'url': 'https://mercato.app/how-it-works',
    },
    {
      '@type': 'HowToStep',
      'position': 4,
      'name': 'SMB Repays Investor',
      'text': 'At the end of the term, the SMB repays the investor principal plus yield on Stellar, completing the transaction and updating their reputation.',
      'url': 'https://mercato.app/how-it-works',
    },
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': 'Is Mercato custodial?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'No, Mercato is completely non-custodial. Funds are held in decentralized smart contracts on Stellar, and only code logic can release them based on milestone approvals.',
      },
    },
    {
      '@type': 'Question',
      'name': 'What assets are used on Mercato?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'All deals on Mercato are denominated in USDC, a dollar-pegged stablecoin, ensuring stability and protecting against local currency or crypto price fluctuations.',
      },
    },
  ],
}

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={howToSchema} />
      <JsonLd data={faqSchema} />
      <HowItWorksView />
    </>
  )
}
