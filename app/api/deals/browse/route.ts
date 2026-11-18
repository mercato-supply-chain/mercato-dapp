import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchDealsBrowseMeta,
  fetchDealsBrowsePage,
  parseDealsBrowseParams,
  type DealsBrowseResponse,
} from '@/lib/deals/browse'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  try {
    const filters = parseDealsBrowseParams(params)
    const supabase = await createClient()

    const [page, meta] = await Promise.all([
      fetchDealsBrowsePage(supabase, filters),
      fetchDealsBrowseMeta(supabase),
    ])

    const body: DealsBrowseResponse = {
      ...page,
      summary: meta.summary,
      categories: meta.categories,
    }
    return NextResponse.json(body)
  } catch (error) {
    console.error('[api/deals/browse]', error)
    return NextResponse.json({ error: 'Failed to load deals' }, { status: 500 })
  }
}
