'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDecimal } from '@/lib/format'
import { formatAmount, intlLocales } from '@/lib/i18n/format'
import { useI18n } from '@/lib/i18n/provider'
import type { LandingHeroDeal } from '@/lib/landing/hero-deal'
import { cn } from '@/lib/utils'

export function HeroDealSheet({ deal }: { deal: LandingHeroDeal }) {
  const { locale, t } = useI18n()
  const isLive = deal.source === 'live'
  const numbers = new Intl.NumberFormat(intlLocales[locale])

  const product = isLive ? deal.productName : t('landing.hero.deal.sample.product')
  const buyer = isLive ? deal.buyerName : t('landing.hero.deal.sample.buyer')
  const supplier = isLive ? deal.supplierName : t('landing.hero.deal.sample.supplier')

  return (
    <article
      aria-labelledby="hero-order-title"
      className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]"
    >
      <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="size-4" aria-hidden="true" />
            <span>{t('landing.hero.deal.orderLabel')}</span>
          </div>
          <Badge
            variant="secondary"
            className={cn(isLive && 'bg-brand-pale text-brand-dark dark:text-[#A6DCB7]')}
          >
            {t(isLive ? 'landing.hero.deal.statusOpen' : 'landing.hero.deal.statusSample')}
          </Badge>
        </div>

        <h2 id="hero-order-title" className="mt-3 break-words text-xl font-semibold tracking-tight sm:text-2xl">
          {product || t('landing.hero.deal.orderLabel')}
        </h2>
        {deal.quantity > 0 ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t('landing.hero.deal.units', { count: numbers.format(deal.quantity) })}
          </p>
        ) : null}

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {buyer ? (
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{t('landing.hero.deal.buyer')}</dt>
              <dd className="mt-0.5 break-words font-medium">{buyer}</dd>
            </div>
          ) : null}
          {supplier ? (
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{t('landing.hero.deal.supplier')}</dt>
              <dd className="mt-0.5 break-words font-medium">{supplier}</dd>
            </div>
          ) : null}
        </dl>

        {isLive ? (
          <Link
            href={deal.href}
            className="mt-4 inline-flex min-h-8 items-center rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {t('landing.hero.deal.ctaLive')}
          </Link>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 border-t border-border lg:border-l lg:border-t-0">
        <div className="min-w-0 p-4 sm:px-6 sm:py-6 lg:flex lg:flex-col lg:justify-center lg:px-8">
          <dt className="text-sm font-medium text-muted-foreground">{t('landing.hero.deal.invoice')}</dt>
          <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-display text-[clamp(1.35rem,4.3vw,2.75rem)] leading-none tracking-tight tabular-nums">
            <span className="break-all">{formatDecimal(deal.invoiceAmount, undefined, intlLocales[locale])}</span>
            <span className="font-sans text-xs font-medium tracking-normal text-muted-foreground">USDC</span>
          </dd>
          <dd className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t('landing.hero.deal.invoiceHint')}
          </dd>
        </div>
        <div className="min-w-0 border-l border-border bg-landing-hero-accent p-4 sm:px-6 sm:py-6 lg:flex lg:flex-col lg:justify-center lg:px-8">
          <dt className="text-sm font-medium text-brand-dark dark:text-[#A6DCB7]">
            {t('landing.hero.deal.investorReceives')}
          </dt>
          <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-display text-[clamp(1.35rem,4.3vw,2.75rem)] leading-none tracking-tight tabular-nums">
            <span className="break-all">{formatAmount(locale, deal.investorReceives)}</span>
            <span className="font-sans text-xs font-medium tracking-normal text-muted-foreground">USDC</span>
          </dd>
          <dd className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t('landing.hero.deal.repaymentHint', { days: numbers.format(deal.termDays) })}
          </dd>
        </div>
      </dl>
    </article>
  )
}
