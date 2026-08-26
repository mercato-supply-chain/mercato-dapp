import { CustomerActivityTable } from './customer-activity-table'
import type { SupplierCustomerActivity } from '@/lib/suppliers/get-supplier-commercial-activity'
import type { buildCustomerActivityTableLabels } from '@/lib/suppliers/supplier-activity-labels'

type CustomerActivitySectionProps = {
  sectionTitle: string
  items: SupplierCustomerActivity[]
  labels: ReturnType<typeof buildCustomerActivityTableLabels>
}

export function SupplierCustomerActivitySection({
  sectionTitle,
  items,
  labels,
}: CustomerActivitySectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{sectionTitle}</h2>
      <CustomerActivityTable items={items} labels={labels} />
    </section>
  )
}
