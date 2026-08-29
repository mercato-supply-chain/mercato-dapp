import { ProductPerformanceTable } from './product-performance-table'
import type { SupplierProductPerformance } from '@/lib/suppliers/get-supplier-commercial-activity'
import type { buildProductPerformanceTableLabels } from '@/lib/suppliers/supplier-activity-labels'

type ProductPerformanceSectionProps = {
  sectionTitle: string
  items: SupplierProductPerformance[]
  labels: ReturnType<typeof buildProductPerformanceTableLabels>
}

export function SupplierProductPerformanceSection({
  sectionTitle,
  items,
  labels,
}: ProductPerformanceSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{sectionTitle}</h2>
      <ProductPerformanceTable items={items} labels={labels} />
    </section>
  )
}
