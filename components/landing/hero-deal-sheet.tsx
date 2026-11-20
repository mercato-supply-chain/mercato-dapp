'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Building2, Factory } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import type { Locale } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/provider'
import type { LandingHeroDeal } from '@/lib/landing/hero-deal'
import { cn } from '@/lib/utils'

function numberLocale(locale: Locale): string {
  return locale === 'es' ? 'es-MX' : 'en-US'
}

/** Whole dollars when exact, cents otherwise — `$12,500` / `$13,437.50`. */
function formatHeroMoney(locale: Locale, value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2
  return formatCurrency(value, 'USD', numberLocale(locale), {
    minFractionDigits: digits,
    maxFractionDigits: digits,
  })
}

function Party({
  label,
  name,
  icon: Icon,
  align = 'left',
}: {
  label: string
  name: string
  icon: React.ElementType
  align?: 'left' | 'right'
}) {
  return (
    <div className={cn('min-w-0', align === 'right' && 'text-right')}>
      <dt
        className={cn(
          'flex items-center gap-1.5 text-xs text-muted-foreground',
          align === 'right' && 'justify-end',
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-brand-mid dark:text-brand-light" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-foreground" title={name}>
        {name}
      </dd>
    </div>
  )
}

type HeroDealSheetProps = {
  deal: LandingHeroDeal
  className?: string
}

/**
 * The landing hero's subject: one financing obligation shown as a term sheet.
 * The workshop photo sits in the header as context for the goods being bought.
 */
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
        'overflow-hidden rounded-2xl border border-border bg-card text-card-foreground',
        'shadow-[0_24px_60px_-28px_hsl(var(--brand-dark)/0.35)] dark:border-white/10 dark:shadow-[0_24px_60px_-28px_hsl(0_0%_0%/0.8)]',
        className,
      )}
    >
      <div className="relative h-16 sm:h-28">
        <Image
          src="/hero-photo.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 28rem, 100vw"
          priority
          className="object-cover object-[50%_60%]"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" aria-hidden />
        <div className="absolute inset-x-4 bottom-3 flex flex-wrap items-center justify-between gap-2 text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'bg-brand-light' : 'bg-white/70')}
              aria-hidden
            />
            {isLive ? t('landing.hero.deal.statusOpen') : t('landing.hero.deal.statusSample')}
          </span>
          {deal.reference && (
            <span className="font-mono text-xs text-white/80">
              {t('landing.hero.deal.reference', { ref: deal.reference })}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5 sm:space-y-5 sm:p-6">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{productName}</span>
          {units && <> · {units}</>}
        </p>

        <dl className="grid grid-cols-2 gap-4">
          <Party label={t('landing.hero.deal.buyer')} name={buyerName} icon={Building2} />
          <Party
            label={t('landing.hero.deal.supplier')}
            name={supplierName}
            icon={Factory}
            align="right"
          />
        </dl>

        <dl className="divide-y divide-border rounded-xl border border-border">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
            <dt className="text-sm text-muted-foreground">{t('landing.hero.deal.invoice')}</dt>
            <dd className="font-display text-2xl tabular-nums tracking-tight text-foreground">
              {money(deal.invoiceAmount)}
            </dd>
            <dd className="w-full text-xs text-muted-foreground">
              {t('landing.hero.deal.invoiceHint')}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-brand-ultra/60 p-4 dark:bg-white/[0.03]">
            <dt className="text-sm font-medium text-foreground">
              {t('landing.hero.deal.investorReceives')}
            </dt>
            <dd className="font-display text-3xl tabular-nums tracking-tight text-brand-mid dark:text-brand-light">
              {money(deal.investorReceives)}
            </dd>
            <dd className="w-full text-xs text-muted-foreground">
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {isLive ? t('landing.hero.deal.settlement') : t('landing.hero.deal.sampleNote')}
          </p>
          <Button asChild size="sm" className="shrink-0">
            <Link href={deal.href}>
              {isLive ? t('landing.hero.deal.ctaLive') : t('landing.hero.deal.ctaSample')}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
