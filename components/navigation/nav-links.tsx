'use client'

import Link from 'next/link'
import { Package, TrendingUp } from 'lucide-react'

const links = [
  { href: '/marketplace', label: 'Marketplace', icon: TrendingUp },
  { href: '/suppliers', label: 'Suppliers', icon: Package },
  { href: '/how-it-works', label: 'How It Works', icon: Package },
] as const

interface NavLinksProps {
  /** Desktop: horizontal nav. Mobile: vertical list in sheet. */
  variant: 'desktop' | 'mobile'
}

export function NavLinks({ variant }: NavLinksProps) {
  const isDesktop = variant === 'desktop'

  if (isDesktop) {
    return (
      <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
    )
  }

  return (
    <>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </Link>
      ))}
    </>
  )
}
