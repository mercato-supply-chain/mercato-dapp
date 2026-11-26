'use client'

import Image from 'next/image'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import type { Locale } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/provider'
import type { LandingHeroDeal } from '@/lib/landing/hero-deal'
import { cn } from '@/lib/utils'

function numberLocale(locale: Locale): string {
  return locale === 'es' ? 'es-MX' : 'en-US'
}

function formatHeroMoney(locale: Locale, value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2
  return formatCurrency(value, 'USD', numberLocale(locale), {
    minFractionDigits: digits,
    maxFractionDigits: digits,
  })
}

type HeroDealSheetProps = {
  deal: LandingHeroDeal
  className?: string
}

export function HeroDealSheet({ deal, className }: HeroDealSheetProps) {
  const { locale, t } = useI18n()
  const isLive = deal.source === 'live'
  const money = (value: number) => formatHeroMoney(locale, value)

  const productName = deal.productName ?? t('landing.hero.deal.sample.product')
  const buyerName = deal.buyerName ?? t('landing.hero.deal.sample.buyer')
  const supplierName = deal.supplierName ?? t('landing.hero.deal.sample.supplier')
  const units =
    deal.quantity > 0
      ? t('landing.hero.deal.units', {
          count: new Intl.NumberFormat(numberLocale(locale)).format(deal.quantity),
        })
      : null

  return (
    <article
      aria-label={t('landing.hero.deal.ariaLabel')}
      className={cn(
        'hero-stagger-4 grid overflow-hidden border border-border bg-card text-card-foreground',
        'md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]',
        className,
      )}
    >
      <div className="relative h-40 md:h-auto">
        <Image
          src="/hero-photo.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 15rem, (min-width: 768px) 13rem, 100vw"
          priority
          className="object-cover object-[50%_60%]"
          aria-hidden
        />
      </div>

      <div className="flex min-w-0 flex-col p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-medium text-brand-mid dark:text-brand-light">
            {isLive ? t('landing.hero.deal.statusOpen') : t('landing.hero.deal.statusSample')}
          </p>
          {deal.reference ? (
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {t('landing.hero.deal.reference', { ref: deal.reference })}
            </p>
          ) : null}
        </div>

        <h2 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
          {productName}
          {units ? (
            <span className="mt-1 block font-sans text-sm font-normal text-muted-foreground">
              {units}
            </span>
          ) : null}
        </h2>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-border py-4">
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">{t('landing.hero.deal.buyer')}</dt>
            <dd className="mt-1 truncate text-sm font-medium" title={buyerName}>
              {buyerName}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">{t('landing.hero.deal.supplier')}</dt>
            <dd className="mt-1 truncate text-sm font-medium" title={supplierName}>
              {supplierName}
            </dd>
          </div>
        </dl>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">{t('landing.hero.deal.invoice')}</dt>
            <dd className="mt-1 font-display text-[1.65rem] tabular-nums leading-none tracking-tight">
              {money(deal.invoiceAmount)}
              <span className="ml-1.5 font-sans text-xs font-medium text-muted-foreground">
                {t('landing.hero.deal.asset')}
              </span>
            </dd>
            <dd className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t('landing.hero.deal.invoiceHint')}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('landing.hero.deal.investorReceives')}</dt>
            <dd className="mt-1 font-display text-[1.65rem] tabular-nums leading-none tracking-tight">
              {money(deal.investorReceives)}
              <span className="ml-1.5 font-sans text-xs font-medium text-muted-foreground">
                {t('landing.hero.deal.asset')}
              </span>
            </dd>
            <dd className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t('landing.hero.deal.investorHint', {
                principal: money(deal.invoiceAmount),
                yield: money(deal.investorProfit),
                days: deal.termDays,
              })}
              {' · '}
              {t('landing.hero.deal.rateHint', {
                rate: new Intl.NumberFormat(numberLocale(locale), {
                  maximumFractionDigits: 2,
                }).format(deal.ratePercent),
              })}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <p className="text-xs text-muted-foreground">
            {isLive ? t('landing.hero.deal.settlement') : t('landing.hero.deal.sampleNote')}
          </p>
          <Link
            href={deal.href}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {isLive ? t('landing.hero.deal.ctaLive') : t('landing.hero.deal.ctaSample')}
          </Link>
        </div>
      </div>
    </article>
  )
}
