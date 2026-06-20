'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'
import type { BlogAudience } from '@/lib/blog/types'

type CtaLink = { href: string; labelKey: string }

type CtaConfig = {
  titleKey: string
  descriptionKey: string
  primary: CtaLink
  secondary: CtaLink[]
}

const CTA_BY_AUDIENCE: Record<BlogAudience, CtaConfig> = {
  investor: {
    titleKey: 'landing.blogEndCta.title',
    descriptionKey: 'landing.blogEndCta.description',
    primary: { href: '/dashboard/vault', labelKey: 'landing.blogEndCta.primaryCta' },
    secondary: [
      { href: '/auth/sign-up', labelKey: 'landing.blogEndCta.secondaryCta' },
      { href: '/deals', labelKey: 'landing.blogEndCta.tertiaryCta' },
    ],
  },
  pyme: {
    titleKey: 'landing.blogEndCta.pyme.title',
    descriptionKey: 'landing.blogEndCta.pyme.description',
    primary: { href: '/create-deal', labelKey: 'landing.blogEndCta.pyme.primaryCta' },
    secondary: [{ href: '/deals', labelKey: 'landing.blogEndCta.pyme.secondaryCta' }],
  },
  supplier: {
    titleKey: 'landing.blogEndCta.supplier.title',
    descriptionKey: 'landing.blogEndCta.supplier.description',
    primary: {
      href: '/dashboard/supplier-profile',
      labelKey: 'landing.blogEndCta.supplier.primaryCta',
    },
    secondary: [{ href: '/suppliers', labelKey: 'landing.blogEndCta.supplier.secondaryCta' }],
  },
  all: {
    titleKey: 'landing.blogEndCta.all.title',
    descriptionKey: 'landing.blogEndCta.all.description',
    primary: { href: '/auth/sign-up', labelKey: 'landing.blogEndCta.all.primaryCta' },
    secondary: [
      { href: '/create-deal', labelKey: 'landing.blogEndCta.pyme.primaryCta' },
      { href: '/dashboard/supplier-profile', labelKey: 'landing.blogEndCta.supplier.primaryCta' },
      { href: '/dashboard/vault', labelKey: 'landing.blogEndCta.primaryCta' },
    ],
  },
}

export function BlogEndCta({ audience = 'all' }: { audience?: BlogAudience }) {
  const { t } = useI18n()
  const config = CTA_BY_AUDIENCE[audience]

  return (
    <section
      aria-labelledby="blog-end-cta-heading"
      className="mt-16 rounded-2xl border border-border/70 bg-card px-6 py-8 shadow-sm sm:px-8 sm:py-10"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            {t('landing.blogEndCta.eyebrow')}
          </p>
          <h2
            id="blog-end-cta-heading"
            className="font-display text-2xl font-normal tracking-tight text-balance sm:text-3xl"
          >
            {t(config.titleKey)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t(config.descriptionKey)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 sm:items-end">
          <Button asChild className="h-11 rounded-full bg-emerald-600 px-6 hover:bg-emerald-700">
            <Link href={config.primary.href}>
              {t(config.primary.labelKey)}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {config.secondary.map((link, index) => (
              <Button
                key={link.href}
                asChild
                variant={index === 0 ? 'outline' : 'ghost'}
                size="sm"
                className={
                  index === 0
                    ? 'rounded-full'
                    : 'rounded-full text-muted-foreground'
                }
              >
                <Link href={link.href}>{t(link.labelKey)}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
