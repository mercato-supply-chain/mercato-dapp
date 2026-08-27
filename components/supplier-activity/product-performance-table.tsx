import { formatUSDC } from '@/lib/format'
import type { SupplierProductPerformance } from '@/lib/suppliers/get-supplier-commercial-activity'

type ProductPerformanceTableProps = {
  items: SupplierProductPerformance[]
  labels: {
    title: string
    product: string
    category: string
    requests: string
    funded: string
    conversion: string
    financedVolume: string
    completedVolume: string
    empty: string
  }
}

export function ProductPerformanceTable({ items, labels }: ProductPerformanceTableProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <caption className="sr-only">{labels.title}</caption>
        <thead className="border-b bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">{labels.product}</th>
            <th className="px-3 py-2 font-medium">{labels.category}</th>
            <th className="px-3 py-2 font-medium">{labels.requests}</th>
            <th className="px-3 py-2 font-medium">{labels.funded}</th>
            <th className="px-3 py-2 font-medium">{labels.conversion}</th>
            <th className="px-3 py-2 font-medium">{labels.financedVolume}</th>
            <th className="px-3 py-2 font-medium">{labels.completedVolume}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.productId} className="border-b last:border-0">
              <td className="px-3 py-2">{item.productName}</td>
              <td className="px-3 py-2">{item.category}</td>
              <td className="px-3 py-2 tabular-nums">{item.financingRequestCount}</td>
              <td className="px-3 py-2 tabular-nums">{item.fundedRequestCount}</td>
              <td className="px-3 py-2 tabular-nums">
                {(item.financingConversionRate * 100).toFixed(1)}%
              </td>
              <td className="px-3 py-2 tabular-nums">{formatUSDC(item.financedVolume)}</td>
              <td className="px-3 py-2 tabular-nums">{formatUSDC(item.completedVolume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
