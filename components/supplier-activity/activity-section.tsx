import { SupplierActivityTable } from './activity-table'
import { SupplierActivityPaginationControls } from './pagination-controls'
import type { SupplierCommercialActivityItem } from '@/lib/suppliers/get-supplier-commercial-activity'
import type { SupplierCommercialState } from '@/lib/suppliers/commercial-states'
import type { SupplierActivityFilterQuery } from '@/lib/suppliers/supplier-activity-url'
import type {
  buildActivityTableLabels,
  buildPaginationLabels,
} from '@/lib/suppliers/supplier-activity-labels'

type ActivitySectionProps = {
  sectionTitle: string
  items: SupplierCommercialActivityItem[]
  stateLabels: Record<SupplierCommercialState, string>
  tableLabels: ReturnType<typeof buildActivityTableLabels>
  page: number
  totalPages: number
  filterQuery: SupplierActivityFilterQuery
  paginationLabels: ReturnType<typeof buildPaginationLabels>
}

export function SupplierActivitySection({
  sectionTitle,
  items,
  stateLabels,
  tableLabels,
  page,
  totalPages,
  filterQuery,
  paginationLabels,
}: ActivitySectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{sectionTitle}</h2>
      <SupplierActivityTable items={items} stateLabels={stateLabels} labels={tableLabels} />
      <SupplierActivityPaginationControls
        page={page}
        totalPages={totalPages}
        filterQuery={filterQuery}
        labels={paginationLabels}
      />
    </section>
  )
}
