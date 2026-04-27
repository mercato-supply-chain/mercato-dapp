'use client'

import Link from 'next/link'
import { Package, PieChart, Store, TrendingUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

const links = [
  { href: '/deals', labelKey: 'nav.deals', icon: TrendingUp },
  { href: '/suppliers', labelKey: 'nav.suppliers', icon: Package },
  { href: '/pymes', labelKey: 'nav.smbs', icon: Store },
  { href: '/investors', labelKey: 'nav.investors', icon: PieChart },
  { href: '/how-it-works', labelKey: 'nav.howItWorks', icon: Package },
] as const

interface NavLinksProps {
  /** Desktop: horizontal nav. Mobile: vertical list in sheet. */
  variant: 'desktop' | 'mobile'
}

export function NavLinks({ variant }: NavLinksProps) {
  const isDesktop = variant === 'desktop'
  const { t } = useI18n()

  if (isDesktop) {
    return (
      <nav className="hidden items-center gap-6 md:flex" aria-label={t('nav.main')}>
        {links.map(({ href, labelKey }) => (
          <Link
            key={href}
            href={href}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t(labelKey)}
          </Link>
        ))}
      </nav>
    )
  }

  return (
    <>
      {links.map(({ href, labelKey, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Icon className="h-4 w-4" aria-hidden />
          {t(labelKey)}
        </Link>
      ))}
    </>
  )
}
