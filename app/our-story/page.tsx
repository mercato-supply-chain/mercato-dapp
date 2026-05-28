import Script from 'next/script'
import Link from 'next/link'
import { LandingCta } from '@/components/landing/landing-cta'

export async function generateMetadata() {
  return {
    title: 'Our Story | Mercato Supply Chain Finance',
    description:
      'Discover why Mercato was built: closing the supply chain financing gap for SMEs in Latin America through blockchain-secured escrow.',
    openGraph: {
      title: 'Our Story | Mercato',
      description: 'Closing the supply chain financing gap for SMEs in Latin America.',
      url: 'https://mercato-dapp.vercel.app/our-story',
      type: 'article',
    },
    alternates: {
      canonical: 'https://mercato-dapp.vercel.app/our-story',
      languages: { es: '/es/our-story', en: '/en/our-story' },
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

export default function OurStoryPage() {
  return (
    <>
      <Script
        id="article-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">

        <h1 className="text-4xl font-bold tracking-tight mb-4">Our Story</h1>
        <p className="text-lg text-muted-foreground mb-16">
          Why we built Mercato, who it serves, and how it works.
        </p>

        {/* Section 1 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">What is Mercato?</h2>
          <p className="text-base leading-7">
            Mercato is a supply chain finance platform that helps small and medium businesses
            (PyMEs) in Latin America access working capital through blockchain-secured escrow.
            Investors fund deals, suppliers receive milestone payments, and every transaction
            settles in USDC on the Stellar network — transparently and without a bank in the middle.
          </p>
        </section>

        {/* Section 2 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Why was Mercato created?</h2>
          <p className="text-base leading-7">
            Tens of millions of small businesses across Latin America cannot access short-term
            working capital from traditional banks. Without credit, they cannot pay suppliers
            upfront — which means suppliers wait months for payment, buyers miss sales cycles,
            and growth stalls. Mercato was built to break that cycle by connecting PyMEs directly
            with investors through transparent, rules-based escrow.
          </p>
        </section>

        {/* Section 3 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Who does Mercato serve?</h2>
          <p className="text-base leading-7 mb-4">
            Mercato is built for three groups who each have a stake in making supply chains work:
          </p>
          <ul className="space-y-3 text-base leading-7 list-none pl-0">
            <li><strong>PyMEs (buyers)</strong> — Small and medium businesses that need short-term capital to pay suppliers while waiting for their own sales to close.</li>
            <li><strong>Suppliers</strong> — Businesses that deliver goods or services and need partial payment upfront rather than waiting 60–90 days.</li>
            <li><strong>Investors</strong> — Individuals or institutions that want to allocate capital to specific, disclosed deals with transparent, contractual returns.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">How does Mercato work?</h2>
          <ol className="space-y-3 text-base leading-7 list-decimal pl-5">
            <li><strong>Deal setup</strong> — The PyME describes the purchase, sets the term, and splits supplier payment into milestones (e.g. 50% on shipment, 50% on delivery).</li>
            <li><strong>Escrow deployment</strong> — A non-custodial escrow contract is deployed on Stellar via Trustless Work. The PyME signs with their wallet.</li>
            <li><strong>Investor funding</strong> — Investors commit USDC into the escrow from the marketplace. Funds are locked until milestone rules allow release.</li>
            <li><strong>Delivery and releases</strong> — As the supplier delivers, the PyME approves each milestone and the contract releases the corresponding payment on-chain.</li>
            <li><strong>Repayment</strong> — At term end, the PyME repays investors their principal and agreed yield.</li>
          </ol>
        </section>

        {/* Section 5 */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-4">Why blockchain escrow?</h2>
          <p className="text-base leading-7">
            Blockchain escrow makes fund movement transparent, auditable, and rule-bound.
            Neither Mercato nor any single party can move funds outside the agreed contract logic.
            Every release is triggered by milestone approval and settled on-chain in seconds —
            giving suppliers confidence they will be paid and investors confidence their capital
            is protected by code, not promises.
          </p>
        </section>

        {/* CTA reused from landing */}
        <LandingCta />

      </main>
    </>
  )
}