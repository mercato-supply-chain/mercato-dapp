import { Suspense } from 'react'
import { DealsBrowse } from './deals-browse'

export default function DealsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <div className="container mx-auto px-4 py-8">
            <p className="text-muted-foreground">Loading deals…</p>
          </div>
        </div>
      }
    >
      <DealsBrowse />
    </Suspense>
  )
}
