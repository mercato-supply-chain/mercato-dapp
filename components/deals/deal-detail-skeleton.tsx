import { Navigation } from '@/components/navigation'

export function DealDetailSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 h-4 w-36 animate-pulse rounded-full bg-muted" />
        <div className="mb-3 flex gap-2">
          <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="mb-2 h-10 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="mb-8 h-5 w-1/2 animate-pulse rounded-lg bg-muted" />
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-72 animate-pulse rounded-2xl bg-muted" />
            <div className="h-48 animate-pulse rounded-2xl bg-muted" />
          </div>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
