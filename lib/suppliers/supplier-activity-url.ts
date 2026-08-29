export type SupplierActivityFilterQuery = {
  company?: string
  product?: string
  category?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

const SUPPLIER_ACTIVITY_PATH = '/dashboard/supplier-activity'

/** Builds a supplier-activity page URL preserving filters, for a given page number. */
export function buildSupplierActivityHref(
  filters: SupplierActivityFilterQuery,
  page: number,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${SUPPLIER_ACTIVITY_PATH}?${qs}` : SUPPLIER_ACTIVITY_PATH
}
