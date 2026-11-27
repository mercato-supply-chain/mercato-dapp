'use client'

import Link from 'next/link'
import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/provider'

export default function NotFound() {
  const { t } = useI18n()

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main id="main" tabIndex={-1} className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('notFound.title')}
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          {t('notFound.description')}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/">{t('notFound.backHome')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/deals">{t('notFound.browseDeals')}</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
