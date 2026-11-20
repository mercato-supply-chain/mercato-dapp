import { Skeleton } from '@/components/ui/skeleton'

/** Fallback shown while the directory data region streams in.
 *  Dimensions match the final filter row and card grid so the layout does not shift. */
export function PymesSkeleton() {
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full sm:max-w-sm" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[160px]" />
        </div>
      </div>
      <Skeleton className="mb-6 h-5 w-48" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </>
  )
}
