import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { SupplierCommercialState } from '@/lib/suppliers/commercial-states'

type FiltersFormProps = {
  companies: Array<{ id: string; companyName: string }>
  products: Array<{ id: string; name: string; category: string }>
  categories: string[]
  commercialStates: SupplierCommercialState[]
  stateLabels: Record<SupplierCommercialState, string>
  labels: {
    company: string
    product: string
    category: string
    status: string
    dateFrom: string
    dateTo: string
    all: string
    apply: string
    clear: string
  }
  values: {
    companyId?: string
    productId?: string
    category?: string
    commercialStatus?: string
    dateFrom?: string
    dateTo?: string
  }
}

export function SupplierActivityFiltersForm({
  companies,
  products,
  categories,
  commercialStates,
  stateLabels,
  labels,
  values,
}: FiltersFormProps) {
  return (
    <form
      method="get"
      className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <div className="space-y-2">
        <Label htmlFor="company">{labels.company}</Label>
        <select
          id="company"
          name="company"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={values.companyId ?? ''}
        >
          <option value="">{labels.all}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.companyName}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product">{labels.product}</Label>
        <select
          id="product"
          name="product"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={values.productId ?? ''}
        >
          <option value="">{labels.all}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">{labels.category}</Label>
        <select
          id="category"
          name="category"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={values.category ?? ''}
        >
          <option value="">{labels.all}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">{labels.status}</Label>
        <select
          id="status"
          name="status"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={values.commercialStatus ?? ''}
        >
          <option value="">{labels.all}</option>
          {commercialStates.map((state) => (
            <option key={state} value={state}>{stateLabels[state]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateFrom">{labels.dateFrom}</Label>
        <input
          id="dateFrom"
          name="dateFrom"
          type="date"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={values.dateFrom ?? ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateTo">{labels.dateTo}</Label>
        <input
          id="dateTo"
          name="dateTo"
          type="date"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue={values.dateTo ?? ''}
        />
      </div>

      <div className="flex items-end gap-2 md:col-span-2 lg:col-span-3 xl:col-span-6">
        <Button type="submit">{labels.apply}</Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/supplier-activity">{labels.clear}</Link>
        </Button>
      </div>
    </form>
  )
}
