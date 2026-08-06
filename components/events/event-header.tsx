'use client'

import Link from 'next/link'
import { MercatoLogo } from '@/components/mercato-logo'
import { LanguageSwitcher } from '@/components/language-switcher'

export function EventHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="MERCATO home">
          <MercatoLogo className="h-7 w-auto" />
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  )
}
