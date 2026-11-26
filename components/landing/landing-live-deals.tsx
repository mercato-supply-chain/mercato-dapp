import Link from 'next/link'
import { getLandingDealsFeed, dealToFeedItem, illustrativeToFeed } from '@/lib/landing/landing-deal-feed'
import { LandingDealCard } from '@/components/landing/landing-deal-card'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getServerLocale, tr } from '@/lib/i18n/server'
import { createPublicClient } from '@/lib/supabase/public'

export async function LandingLiveDeals() {
  const localePromise = getServerLocale()
  const dealsPromise = getLandingDealsFeed(createPublicClient())
  const locale = await localePromise
  const [t, deals] = await Promise.all([getDictionary(locale), dealsPromise])

  const feed =
    deals.length > 0 ? deals.map(dealToFeedItem) : illustrativeToFeed()

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

  const hasLive = feed.length > 0 && feed[0].isLive

  return (
    <section
      id="live-deals"
      className="landing-section-anchor bg-background py-16 md:py-20"
      aria-labelledby="live-deals-heading"
    >
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-medium text-brand-mid dark:text-brand-light">
              {hasLive
                ? tr(t, 'landing.liveDeals.badgeLive')
                : tr(t, 'landing.liveDeals.badgeActivity')}
              {hasLive
                ? ` · ${tr(
                    t,
                    feed.length === 1
                      ? 'landing.liveDeals.activeDealsOne'
                      : 'landing.liveDeals.activeDealsOther',
                    { count: feed.length },
                  )}`
                : ''}
            </p>
            <h2
              id="live-deals-heading"
              className="font-display mb-2 text-[clamp(1.75rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-tight text-balance"
            >
              {tr(t, 'landing.liveDeals.titlePrefix')} {tr(t, 'landing.liveDeals.titleAccent')}
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
              {tr(t, 'landing.liveDeals.description')}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/deals">{tr(t, 'landing.liveDeals.cta')}</Link>
          </Button>
        </div>

        <div className="border-t border-border">
          {localizedFeed.map((item) => (
            <LandingDealCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
