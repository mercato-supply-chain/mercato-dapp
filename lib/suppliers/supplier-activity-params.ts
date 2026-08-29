import { SUPPLIER_COMMERCIAL_STATES, type SupplierCommercialState } from './commercial-states'

export type SupplierActivityRawParams = {
  company?: string
  product?: string
  category?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: string
}

export type SupplierActivityParsedParams = {
  companyId?: string
  productId?: string
  category?: string
  commercialStatus?: SupplierCommercialState
  dateFrom?: string
  dateTo?: string
  dateFromISO?: string
  dateToISO?: string
  page: number
}

function isSupplierCommercialState(
  value: string | undefined,
): value is SupplierCommercialState {
  return SUPPLIER_COMMERCIAL_STATES.includes(value as SupplierCommercialState)
}

/** Parses and validates raw supplier-activity search params from the URL. */
export function parseSupplierActivityParams(
  params: SupplierActivityRawParams,
): SupplierActivityParsedParams {
  const companyId = params.company?.trim() || undefined
  const productId = params.product?.trim() || undefined
  const category = params.category?.trim() || undefined
  const commercialStatus = isSupplierCommercialState(params.status) ? params.status : undefined
  const dateFrom = params.dateFrom
  const dateTo = params.dateTo
  const dateFromISO = dateFrom
    ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString()
    : undefined
  const dateToISO = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)

  return {
    companyId,
    productId,
    category,
    commercialStatus,
    dateFrom,
    dateTo,
    dateFromISO,
    dateToISO,
    page,
  }
}
