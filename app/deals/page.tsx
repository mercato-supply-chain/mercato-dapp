import { Suspense } from 'react'
import { DealsBrowse } from './deals-browse'
import { getServerDictionary } from '@/lib/i18n/server'
import { JsonLd } from '@/components/seo/json-ld'
import { createClient } from '@/lib/supabase/server'
import {
  fetchDealsBrowseMeta,
  fetchDealsBrowsePage,
  parseDealsBrowseParams,
  type DealBrowseFilters,
  type DealsBrowseMeta,
  type DealsBrowsePage,
} from '@/lib/deals/browse'

export async function generateMetadata() {
  return {
    title: 'Browse Deals | Mercato Supply Chain Finance',
    description: 'Explore live supply chain invoice financing deals in Latin America. Support PyMEs and earn short-term yield secured by smart contracts.',
    alternates: {
      canonical: '/deals',
      languages: {
        en: '/deals?lang=en',
        es: '/deals?lang=es',
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
    {
      '@type': 'ListItem',
      'position': 2,
      'name': 'Deals',
      'item': 'https://mercato.app/deals',
    },
  ],
}

const EMPTY_PAGE: DealsBrowsePage = {
  deals: [],
  page: 1,
  hasMore: false,
  matchCount: 0,
}

const EMPTY_META: DealsBrowseMeta = {
  summary: { total: 0, open: 0, expired: 0, active: 0, completed: 0, totalValue: 0 },
  categories: [],
}

/**
 * Server Component: parses the search params and fetches the first page of
 * deals (plus summary + categories) so the marketplace is part of the
 * server-rendered HTML instead of appearing after hydration.
 */
export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [dict, params] = await Promise.all([getServerDictionary(), searchParams])
  const filters: DealBrowseFilters = parseDealsBrowseParams(params)

  let page = EMPTY_PAGE
  let meta = EMPTY_META
  try {
    const supabase = await createClient()
    const [pageResult, metaResult] = await Promise.all([
      fetchDealsBrowsePage(supabase, filters),
      fetchDealsBrowseMeta(supabase),
    ])
    page = pageResult
    meta = metaResult
  } catch (error) {
    console.error('[app/deals] initial deals fetch failed', error)
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <Suspense
        fallback={
          <div className="flex min-h-screen flex-col">
            <div className="container mx-auto px-4 py-8">
              <p className="text-muted-foreground">{dict.deals.loadingDeals}</p>
            </div>
          </div>
        }
      >
        <DealsBrowse
          initialDeals={page.deals}
          initialPage={page.page}
          initialHasMore={page.hasMore}
          initialMatchCount={page.matchCount}
          initialSummary={meta.summary}
          initialCategories={meta.categories}
          initialFilters={filters}
        />
      </Suspense>
    </>
  )
}
