import { Navigation } from '@/components/navigation'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { InvestorsSkeleton } from './investors-skeleton'

/** Shown during client-side route transitions into /investors.
 *  Matches the server shell so Navigation and headings do not jump. */
export default async function InvestorsLoading() {
  const messages = await getServerDictionary()

  return (
    <div className="flex min-h-screen flex-col" aria-busy>
      <Navigation />
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            {tr(messages, 'investorsPage.title')}
          </h1>
          <p className="text-muted-foreground">{tr(messages, 'investorsPage.subtitle')}</p>
        </div>
        <InvestorsSkeleton />
      </div>
    </div>
  )
}
