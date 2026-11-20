import { Suspense } from 'react'
import { Navigation } from '@/components/navigation'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { PymesData } from './pymes-data'
import { PymesSkeleton } from './pymes-skeleton'

export default async function PymesPage() {
  const messages = await getServerDictionary()

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            {tr(messages, 'pymesPage.title')}
          </h1>
          <p className="text-muted-foreground">{tr(messages, 'pymesPage.subtitle')}</p>
        </div>
        <Suspense fallback={<PymesSkeleton />}>
          <PymesData />
        </Suspense>
      </div>
    </div>
  )
}
