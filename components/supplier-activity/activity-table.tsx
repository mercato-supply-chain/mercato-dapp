import Link from 'next/link'
import { formatUSDC } from '@/lib/format'
import type { SupplierCommercialActivityItem } from '@/lib/suppliers/get-supplier-commercial-activity'
import type { SupplierCommercialState } from '@/lib/suppliers/commercial-states'
import { CommercialStatusBadge } from './commercial-status-badge'

type ActivityTableProps = {
  items: SupplierCommercialActivityItem[]
  stateLabels: Record<SupplierCommercialState, string>
  labels: {
    title: string
    product: string
    customer: string
    company: string
    amount: string
    quantity: string
    unitPrice: string
    status: string
    investor: string
    created: string
    funded: string
    shipped: string
    viewDeal: string
    empty: string
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleDateString()
}

export function SupplierActivityTable({ items, stateLabels, labels }: ActivityTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{labels.empty}</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <caption className="sr-only">{labels.title}</caption>
        <thead className="border-b bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">{labels.product}</th>
            <th className="px-3 py-2 font-medium">{labels.customer}</th>
            <th className="px-3 py-2 font-medium">{labels.company}</th>
            <th className="px-3 py-2 font-medium">{labels.amount}</th>
            <th className="px-3 py-2 font-medium">{labels.quantity}</th>
            <th className="px-3 py-2 font-medium">{labels.unitPrice}</th>
            <th className="px-3 py-2 font-medium">{labels.status}</th>
            <th className="px-3 py-2 font-medium">{labels.investor}</th>
            <th className="px-3 py-2 font-medium">{labels.created}</th>
            <th className="px-3 py-2 font-medium">{labels.funded}</th>
            <th className="px-3 py-2 font-medium">{labels.shipped}</th>
            <th className="px-3 py-2 font-medium">{labels.viewDeal}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.dealId} className="border-b last:border-0">
              <td className="px-3 py-2">{item.productName}</td>
              <td className="px-3 py-2">{item.pymeName}</td>
              <td className="px-3 py-2">{item.supplierCompanyName}</td>
              <td className="px-3 py-2 tabular-nums">{formatUSDC(item.amount)}</td>
              <td className="px-3 py-2 tabular-nums">{item.productQuantity}</td>
              <td className="px-3 py-2 tabular-nums">{formatUSDC(item.productUnitPrice)}</td>
              <td className="px-3 py-2">
                <CommercialStatusBadge
                  state={item.commercialState}
                  label={stateLabels[item.commercialState]}
                />
              </td>
              <td className="px-3 py-2">{item.investorName ?? '—'}</td>
              <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
              <td className="px-3 py-2">{formatDate(item.fundedAt)}</td>
              <td className="px-3 py-2">{formatDate(item.shippedAt)}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/deals/${item.dealId}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {labels.viewDeal}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
