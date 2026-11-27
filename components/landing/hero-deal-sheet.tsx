'use client'

import Link from 'next/link'
import { ArrowUpRight, FileText } from 'lucide-react'
import { formatDecimal } from '@/lib/format'
import { formatAmount, intlLocales } from '@/lib/i18n/format'
import { useI18n } from '@/lib/i18n/provider'
import type { LandingHeroDeal } from '@/lib/landing/hero-deal'
import { cn } from '@/lib/utils'

export function HeroDealSheet({ deal }: { deal: LandingHeroDeal }) {
  const { locale, t } = useI18n()
  const isLive = deal.source === 'live'
  const intlLocale = intlLocales[locale]
  const numbers = new Intl.NumberFormat(intlLocale)

  const product = isLive ? deal.productName : t('landing.hero.deal.sample.product')
  const buyer = isLive ? deal.buyerName : t('landing.hero.deal.sample.buyer')
  const supplier = isLive ? deal.supplierName : t('landing.hero.deal.sample.supplier')

  const payments = [
    {
      label: t('landing.hero.deal.invoice'),
      amount: formatDecimal(deal.invoiceAmount, undefined, intlLocale),
      detail: t('landing.hero.deal.invoiceHint'),
    },
    {
      label: t('landing.hero.deal.investorReceives'),
      amount: formatAmount(locale, deal.investorReceives),
      detail: t('landing.hero.deal.repaymentHint', { days: numbers.format(deal.termDays) }),
    },
  ]

  return (
    <article
      aria-labelledby="hero-order-title"
      className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
    >
      <header className="border-b border-border bg-brand-pale px-4 py-4 sm:px-6 sm:py-5 dark:bg-[#16231c]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-brand-dark dark:text-[#bde8c8]">
            <FileText className="size-4 shrink-0" aria-hidden />
            {t(isLive ? 'landing.hero.deal.orderLabel' : 'landing.hero.deal.statusSample')}
          </p>
          {isLive ? (
            <p className="flex items-center gap-2 text-xs font-medium text-brand-dark dark:text-[#bde8c8]">
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {t('landing.hero.deal.statusOpen')}
            </p>
          ) : null}
        </div>

        <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2
            id="hero-order-title"
            className="font-display text-[clamp(1.55rem,3.5vw,2.25rem)] leading-tight tracking-tight [overflow-wrap:anywhere]"
          >
            {product || t('landing.hero.deal.orderLabel')}
          </h2>
          {deal.quantity > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('landing.hero.deal.units', { count: numbers.format(deal.quantity) })}
            </p>
          ) : null}
        </div>
      </header>

      <div className="px-4 sm:px-6">
        {buyer || supplier ? (
          <dl className="grid grid-cols-2 gap-x-4 border-b border-border py-4 text-sm">
            {buyer ? (
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t('landing.hero.deal.buyer')}</dt>
                <dd className="mt-1 font-medium [overflow-wrap:anywhere]">{buyer}</dd>
              </div>
            ) : null}
            {supplier ? (
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t('landing.hero.deal.supplier')}</dt>
                <dd className="mt-1 font-medium [overflow-wrap:anywhere]">{supplier}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <dl className="divide-y divide-border">
          {payments.map(({ label, amount, detail }, index) => (
            <div
              key={label}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-x-3 gap-y-1 py-3.5 sm:gap-x-6 sm:py-4"
            >
              <dt className="col-start-1 row-start-1 text-sm font-medium">{label}</dt>
              <dd
                className={cn(
                  'col-start-2 row-span-2 row-start-1 flex max-w-[42vw] flex-wrap items-baseline justify-end gap-x-1.5 gap-y-1 text-right font-sans text-lg font-semibold leading-none tracking-tight tabular-nums sm:max-w-48 sm:text-2xl',
                  index === 1 && 'text-brand-dark dark:text-[#bde8c8]',
                )}
              >
                <span className="[overflow-wrap:anywhere]">{amount}</span>
                <span className="text-[0.65rem] font-medium tracking-normal text-muted-foreground sm:text-xs">USDC</span>
              </dd>
              <dd className="col-start-1 row-start-2 text-xs leading-relaxed text-muted-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>

      {isLive ? (
        <footer className="border-t border-border px-4 py-1 sm:px-6">
          <Link
            href={deal.href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t('landing.hero.deal.ctaLive')}
            <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          </Link>
        </footer>
      ) : null}
    </article>
  )
}
