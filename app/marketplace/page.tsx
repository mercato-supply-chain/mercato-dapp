import { redirect } from 'next/navigation'

/** @deprecated Use `/deals` — kept for bookmarks and external links. */
export default async function MarketplaceRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const filter = sp.filter
  const q =
    typeof filter === 'string' && filter
      ? `?filter=${encodeURIComponent(filter)}`
      : ''
  redirect(`/deals${q}`)
}
