'use client'

import * as React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { mapDealFromDb, type DealRow } from '@/lib/deals'
import {
  buildLandingFeed,
  localizeLandingFeedItem,
  splitIntoColumns,
  type LandingFeedItem,
} from '@/lib/landing/landing-deal-feed'
import { useReveal, useScrollProgress } from '@/hooks/use-scroll-motion'
import { LandingDealCard } from '@/components/landing/landing-deal-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/types'
import { ArrowRight, Radio } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

const COLUMN_SPEEDS = [0.38, 0.52, 0.32] as const
const COLUMN_OFFSETS = [0, 80, 40] as const

function WaterfallColumn({
  items,
  speed,
  baseOffset,
  progress,
  scrollPhase,
  colIndex,
}: {
  items: LandingFeedItem[]
  speed: number
  baseOffset: number
  progress: number
  scrollPhase: number
  colIndex: number
}) {
  const scrollY = progress * speed * 280 - baseOffset
  const doubled = [...items, ...items]

  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col overflow-hidden',
        colIndex === 1 && 'hidden sm:flex',
        colIndex === 2 && 'hidden lg:flex',
      )}
    >
      <div style={{ transform: `translate3d(0, ${scrollY}px, 0)` }}>
        <div className="landing-column-drift flex flex-col gap-4 motion-reduce:animate-none md:gap-5">
          {doubled.map((item, i) => {
            const globalIndex = colIndex + i * 3
            const highlighted = (globalIndex + scrollPhase) % 7 === 0
            return (
              <LandingDealCard
                key={`${item.id}-${i}`}
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
    </div>
  )
}

export function LandingLiveDeals() {
  const { t } = useI18n()
  const { ref: sectionRef, progress } = useScrollProgress<HTMLElement>()
  const { ref: headerRef, visible } = useReveal<HTMLDivElement>(0.15)
  const [deals, setDeals] = React.useState<Deal[]>([])
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    const supabase = createClient()
    void (async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(
          `
          *,
          milestones(*),
          pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name, stake_amount)
        `,
        )
        .order('created_at', { ascending: false })
        .limit(12)

      if (!error && data?.length) {
        setDeals((data as DealRow[]).map(mapDealFromDb))
      }
      setLoaded(true)
    })()
  }, [])

  const feed = React.useMemo(
    () => buildLandingFeed(deals).map((item) => localizeLandingFeedItem(item, t)),
    [deals, t],
  )
  const columns = React.useMemo(() => splitIntoColumns(feed, 3), [feed])
  const scrollPhase = Math.min(6, Math.floor(progress * 8))
  const hasLive = deals.length > 0

  return (
    <section
      id="live-deals"
      ref={sectionRef}
      className="landing-section-anchor relative bg-background pt-4 pb-6 md:pt-8 md:pb-8"
      aria-labelledby="live-deals-heading"
    >
      <div className="relative min-h-[62vh] md:min-h-[72vh]">
        <div className="sticky top-16 z-20 flex h-[min(520px,calc(100vh-5.5rem))] flex-col gap-6 overflow-hidden md:top-20 md:h-[min(560px,calc(100vh-6rem))] md:gap-8">
          <div
            ref={headerRef}
            className={cn(
              'container relative isolate z-30 mx-auto shrink-0 bg-background px-4 pb-1 md:px-6 md:pb-2',
              'transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
            )}
          >
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-light/30 bg-brand-ultra/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-mid dark:border-white/10 dark:bg-white/[0.05] dark:text-brand-light">
                <Radio className="h-3 w-3 motion-safe:animate-pulse" aria-hidden />
                {hasLive ? t('landing.liveDeals.badgeLive') : t('landing.liveDeals.badgeActivity')}
              </span>
              {loaded && hasLive && (
                <span className="text-xs text-muted-foreground">
                  {t(deals.length === 1 ? 'landing.liveDeals.activeDealsOne' : 'landing.liveDeals.activeDealsOther', {
                    count: deals.length,
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
                  {t('landing.liveDeals.titlePrefix')}{' '}
                  <span className="text-brand-mid dark:text-brand-light">
                    {t('landing.liveDeals.titleAccent')}
                  </span>
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                  {t('landing.liveDeals.description')}
                </p>
              </div>
              <Button
                asChild
                className="shrink-0 rounded-full bg-brand-mid px-6 font-semibold text-white shadow-glow-brand hover:bg-brand-dark"
              >
                <Link href="/deals">
                  {t('landing.liveDeals.cta')}
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
                transform: `translate(-50%, -50%) scale(${0.9 + progress * 0.15})`,
              }}
              aria-hidden
            />

            <div className="container relative z-10 mx-auto flex h-full gap-3 px-4 md:gap-5 md:px-6">
              {columns.map((colItems, colIndex) => (
                <WaterfallColumn
                  key={colIndex}
                  items={colItems}
                  speed={COLUMN_SPEEDS[colIndex] ?? 0.45}
                  baseOffset={COLUMN_OFFSETS[colIndex] ?? 0}
                  progress={progress}
                  scrollPhase={scrollPhase}
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
