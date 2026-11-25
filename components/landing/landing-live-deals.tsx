import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getLandingDealsFeed,
  dealToFeedItem,
  illustrativeToFeed,
  type LandingFeedItem,
} from '@/lib/landing/landing-deal-feed'
import { LandingDealCard } from '@/components/landing/landing-deal-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight, Radio } from 'lucide-react'
import { getServerDictionary, tr } from '@/lib/i18n/server'

type WaterfallColumnProps = {
  items: LandingFeedItem[]
  colIndex: number
}

function WaterfallColumn({ items, colIndex }: WaterfallColumnProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col overflow-hidden',
        colIndex === 1 && 'hidden sm:flex',
        colIndex === 2 && 'hidden lg:flex',
      )}
    >
      <div className="flex flex-col gap-4 md:gap-5">
        {items.map((item, i) => {
          const globalIndex = colIndex + i * 3
          const highlighted = globalIndex % 7 === 0
          return (
            <LandingDealCard
              key={item.id}
              item={item}
              highlighted={highlighted}
              style={{
                opacity: highlighted ? 1 : 0.88 + (i % 3) * 0.04,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export async function LandingLiveDeals() {
  const t = await getServerDictionary()
  const supabase = await createClient()
  const deals = await getLandingDealsFeed(supabase)

  // Use illustrative deals if no real deals found
  const feed = deals.length > 0
    ? deals.map(dealToFeedItem)
    : illustrativeToFeed()

  // Localize feed items inline (handle illustrative and real deals)
  const localizedFeed = feed.map((item) => {
    const illusMatch = item.id.match(/^illus-(\w+)/)
    if (illusMatch) {
      const sampleKey = illusMatch[1]
      return {
        ...item,
        eventLabel: tr(t, item.eventLabelKey, item.eventLabelParams),
        productName: tr(t, `landing.liveDeals.samples.${sampleKey}.product`),
        companyLine: tr(t, `landing.liveDeals.samples.${sampleKey}.company`),
        category: tr(t, `landing.liveDeals.samples.${sampleKey}.category`),
      }
    }
    return {
      ...item,
      eventLabel: tr(t, item.eventLabelKey, item.eventLabelParams),
    }
  })

  // Split into 3 columns for waterfall layout
  const columns: LandingFeedItem[][] = [[], [], []]
  localizedFeed.forEach((item, i) => columns[i % 3].push(item))

  const hasLive = feed.length > 0 && feed[0].isLive

  return (
    <section
      id="live-deals"
      className="landing-section-anchor relative bg-background pt-4 pb-6 md:pt-8 md:pb-8"
      aria-labelledby="live-deals-heading"
    >
      <div className="relative min-h-[62vh] md:min-h-[72vh]">
        <div className="sticky top-16 z-20 flex h-[min(520px,calc(100vh-5.5rem))] flex-col gap-6 overflow-hidden md:top-20 md:h-[min(560px,calc(100vh-6rem))] md:gap-8">
          <div className="container relative isolate z-30 mx-auto shrink-0 bg-background px-4 pb-1 md:px-6 md:pb-2">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-light/30 bg-brand-ultra/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mid dark:border-white/10 dark:bg-white/[0.05] dark:text-brand-light">
                <Radio className="h-3 w-3 motion-safe:animate-pulse" aria-hidden />
                {hasLive ? tr(t, 'landing.liveDeals.badgeLive') : tr(t, 'landing.liveDeals.badgeActivity')}
              </span>
              {hasLive && (
                <span className="text-xs text-muted-foreground">
                  {tr(t, feed.length === 1 ? 'landing.liveDeals.activeDealsOne' : 'landing.liveDeals.activeDealsOther', {
                    count: feed.length,
                  })}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h2
                  id="live-deals-heading"
                  className="font-display mb-2 text-[clamp(1.75rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-tight text-foreground text-balance"
                >
                  {tr(t, 'landing.liveDeals.titlePrefix')}{' '}
                  <span className="text-brand-mid dark:text-brand-light">
                    {tr(t, 'landing.liveDeals.titleAccent')}
                  </span>
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                  {tr(t, 'landing.liveDeals.description')}
                </p>
              </div>
              <Button
                asChild
                className="shrink-0 rounded-full bg-brand-mid px-6 font-semibold text-white shadow-glow-brand hover:bg-brand-dark"
              >
                <Link href="/deals">
                  {tr(t, 'landing.liveDeals.cta')}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>

          <div className="landing-waterfall-mask relative min-h-0 flex-1">
            <div
              className="landing-waterfall-fade-top pointer-events-none absolute inset-x-0 top-0 z-20"
              aria-hidden
            />
            <div
              className="landing-waterfall-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-20"
              aria-hidden
            />

            <div
              className="pointer-events-none absolute left-1/2 top-[62%] z-0 h-[min(60vw,360px)] w-[min(60vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 dark:opacity-25"
              style={{
                background:
                  'radial-gradient(circle, hsl(var(--brand-light) / 0.1) 0%, transparent 70%)',
              }}
              aria-hidden
            />

            <div className="container relative z-10 mx-auto flex h-full gap-3 px-4 md:gap-5 md:px-6">
              {columns.map((colItems, colIndex) => (
                <WaterfallColumn
                  key={colIndex}
                  items={colItems}
                  colIndex={colIndex}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
