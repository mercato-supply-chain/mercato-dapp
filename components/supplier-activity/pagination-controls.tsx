import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  buildSupplierActivityHref,
  type SupplierActivityFilterQuery,
} from '@/lib/suppliers/supplier-activity-url'
import type { buildPaginationLabels } from '@/lib/suppliers/supplier-activity-labels'

type PaginationControlsProps = {
  page: number
  totalPages: number
  filterQuery: SupplierActivityFilterQuery
  labels: ReturnType<typeof buildPaginationLabels>
}

export function SupplierActivityPaginationControls({
  page,
  totalPages,
  filterQuery,
  labels,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        {labels.pagination.replace('{page}', String(page)).replace('{total}', String(totalPages))}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildSupplierActivityHref(filterQuery, page - 1)}>
              {labels.prevPage}
            </Link>
          </Button>
        )}
        {page < totalPages && (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildSupplierActivityHref(filterQuery, page + 1)}>
              {labels.nextPage}
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
