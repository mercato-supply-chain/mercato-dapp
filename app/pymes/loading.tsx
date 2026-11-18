import { Navigation } from '@/components/navigation'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { PymesSkeleton } from './pymes-skeleton'

/** Shown during client-side route transitions into /pymes.
 *  Matches the server shell so Navigation and headings do not jump. */
export default async function PymesLoading() {
  const messages = await getServerDictionary()

  return (
    <div className="flex min-h-screen flex-col" aria-busy>
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            {tr(messages, 'pymesPage.title')}
          </h1>
          <p className="text-muted-foreground">{tr(messages, 'pymesPage.subtitle')}</p>
        </div>
        <PymesSkeleton />
      </div>
    </div>
  )
}
