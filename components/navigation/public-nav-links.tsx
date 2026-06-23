'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/provider'
import {
  landingSectionHref,
  PUBLIC_NAV_LINKS,
  PUBLIC_PAGE_LINKS,
  type LandingSectionId,
} from '@/lib/navigation/landing-nav'

interface PublicNavLinksProps {
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export function PublicNavLinks({ variant, onNavigate }: PublicNavLinksProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const onHome = pathname === '/'
  const [activeSection, setActiveSection] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!onHome) {
      setActiveSection(null)
      return
    }

    const syncHash = () => {
      const id = window.location.hash.replace('#', '')
      setActiveSection(id || null)
    }

    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [onHome, pathname])

  const linkClass = (sectionId: LandingSectionId) =>
    cn(
      variant === 'desktop'
        ? 'text-sm font-medium transition-colors'
        : 'flex items-center text-sm font-medium py-0.5',
      onHome && activeSection === sectionId
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground',
    )

  const handleSectionClick = (sectionId: string) => {
    if (onHome && window.location.hash === `#${sectionId}`) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    onNavigate?.()
  }

  const sectionItems = PUBLIC_NAV_LINKS.map(({ sectionId, labelKey }) => (
    <Link
      key={sectionId}
      href={landingSectionHref(sectionId, onHome)}
      className={linkClass(sectionId)}
      onClick={() => handleSectionClick(sectionId)}
    >
      {t(labelKey)}
    </Link>
  ))

  const pageItems = PUBLIC_PAGE_LINKS.map(({ href, labelKey }) => (
    <Link
      key={href}
      href={href}
      className={cn(
        variant === 'desktop'
          ? 'text-sm font-medium transition-colors'
          : 'flex items-center text-sm font-medium py-0.5',
        pathname.startsWith(href)
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={onNavigate}
    >
      {t(labelKey)}
    </Link>
  ))

  const items = [...sectionItems, ...pageItems]

  if (variant === 'desktop') {
    return (
      <nav className="hidden items-center gap-5 md:flex xl:gap-6" aria-label={t('nav.marketing')}>
        {items}
      </nav>
    )
  }

  return <>{items}</>
}
