import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatUSDC } from '@/lib/format'
import type { SupplierCommercialSummary } from '@/lib/suppliers/get-supplier-commercial-activity'

type SummaryCardsProps = {
  summary: SupplierCommercialSummary
  labels: {
    openRequests: string
    activeFinanced: string
    completedFinanced: string
    pendingShipments: string
    totalVolume: string
  }
}

export function SupplierActivitySummaryCards({ summary, labels }: SummaryCardsProps) {
  const items = [
    { label: labels.openRequests, value: String(summary.openFinancingRequests) },
    { label: labels.activeFinanced, value: String(summary.activeFinancedSales) },
    { label: labels.completedFinanced, value: String(summary.completedFinancedSales) },
    { label: labels.pendingShipments, value: String(summary.pendingShipments) },
    { label: labels.totalVolume, value: formatUSDC(summary.totalFinancedVolume) },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
