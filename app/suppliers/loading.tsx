import { Building2 } from 'lucide-react'
import { Navigation } from '@/components/navigation'
import { getServerDictionary, tr } from '@/lib/i18n/server'
import { SuppliersSkeleton } from './suppliers-skeleton'

/** Shown during client-side route transitions into /suppliers.
 *  Matches the server shell so Navigation and headings do not jump. */
export default async function SuppliersLoading() {
  const messages = await getServerDictionary()

  return (
    <div className="flex min-h-screen flex-col" aria-busy>
      <Navigation />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
            <Building2 className="h-3 w-3" aria-hidden />
            {tr(messages, 'suppliersPage.eyebrow')}
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">
            {tr(messages, 'suppliersPage.title')}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {tr(messages, 'suppliersPage.description')}
          </p>
        </div>
        <SuppliersSkeleton />
      </div>
    </div>
  )
}
