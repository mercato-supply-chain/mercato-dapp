import { Button } from '@/components/ui/button'
import type { ReferralActivityItem } from '@/lib/referrals/activity-grouping'

type Labels = {
  title: string
  empty: string
  openedTimes: string
  eventLabels: Record<string, string>
}

type Props = {
  items: ReferralActivityItem[]
  labels: Labels
  page: number
  total: number
  pageSize: number
  baseQuery: string
}

export function ReferralActivityTimeline({ items, labels, page, total, pageSize, baseQuery }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => {
            const eventLabel = labels.eventLabels[item.eventType] ?? item.eventType
            const openLabel =
              item.eventType === 'link_opened' && item.groupedOpenCount && item.groupedOpenCount > 1
                ? labels.openedTimes.replace('{count}', String(item.groupedOpenCount))
                : eventLabel

            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-3"
              >
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{openLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {pageCount > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/dashboard/referrals?${baseQuery}&actPage=${page - 1}`}>Prev</a>
            </Button>
          )}
          {page < pageCount && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/dashboard/referrals?${baseQuery}&actPage=${page + 1}`}>Next</a>
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
