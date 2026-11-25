import type { Locale } from '@/lib/i18n/config'
import { formatLocalizedDate, formatMoney } from '@/lib/i18n/format'
import type { SupplierCustomerActivity } from '@/lib/suppliers/get-supplier-commercial-activity'

type CustomerActivityTableProps = {
  locale: Locale
  items: SupplierCustomerActivity[]
  labels: {
    title: string
    customer: string
    products: string
    requests: string
    requestValue: string
    funded: string
    awaiting: string
    lastActivity: string
    empty: string
  }
}

export function CustomerActivityTable({ items, labels, locale }: CustomerActivityTableProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <caption className="sr-only">{labels.title}</caption>
        <thead className="border-b bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">{labels.customer}</th>
            <th className="px-3 py-2 font-medium">{labels.products}</th>
            <th className="px-3 py-2 font-medium">{labels.requests}</th>
            <th className="px-3 py-2 font-medium">{labels.requestValue}</th>
            <th className="px-3 py-2 font-medium">{labels.funded}</th>
            <th className="px-3 py-2 font-medium">{labels.awaiting}</th>
            <th className="px-3 py-2 font-medium">{labels.lastActivity}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.pymeId} className="border-b last:border-0">
              <td className="px-3 py-2">{item.pymeName}</td>
              <td className="px-3 py-2">{item.productsRequested.join(', ')}</td>
              <td className="px-3 py-2 tabular-nums">{item.financingRequestCount}</td>
              <td className="px-3 py-2 tabular-nums">{formatMoney(locale, item.financingRequestValue)}</td>
              <td className="px-3 py-2 tabular-nums">{item.fundedRequestCount}</td>
              <td className="px-3 py-2 tabular-nums">{item.awaitingFundingCount}</td>
              <td className="px-3 py-2">{formatLocalizedDate(item.mostRecentActivityAt, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
