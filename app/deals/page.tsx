import { Suspense } from 'react'
import { DealsBrowse } from './deals-browse'
import { getServerDictionary } from '@/lib/i18n/server'

export default async function DealsPage() {
  const dict = await getServerDictionary()

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <div className="container mx-auto px-4 py-8">
            <p className="text-muted-foreground">{dict.deals.loadingDeals}</p>
          </div>
        </div>
      }
    >
      <DealsBrowse />
    </Suspense>
  )
}
