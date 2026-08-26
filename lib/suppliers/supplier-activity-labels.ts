import type { Messages } from '@/lib/i18n/dictionaries'
import type { SupplierCommercialState } from './commercial-states'

export type SupplierActivityMessages = Messages['supplierActivity']

export function getSupplierActivityStateLabels(
  m: SupplierActivityMessages,
): Record<SupplierCommercialState, string> {
  return m.states
}

export function buildSummaryCardLabels(m: SupplierActivityMessages) {
  return {
    openRequests: m.summary.openRequests,
    activeFinanced: m.summary.activeFinanced,
    completedFinanced: m.summary.completedFinanced,
    pendingShipments: m.summary.pendingShipments,
    totalVolume: m.summary.totalVolume,
  }
}

export function buildFiltersFormLabels(m: SupplierActivityMessages) {
  return {
    company: m.filters.company,
    product: m.filters.product,
    category: m.filters.category,
    status: m.filters.status,
    dateFrom: m.filters.dateFrom,
    dateTo: m.filters.dateTo,
    all: m.filters.all,
    apply: m.filters.apply,
    clear: m.filters.clear,
  }
}

export function buildActivityTableLabels(m: SupplierActivityMessages) {
  return {
    title: m.activityTitle,
    product: m.table.product,
    customer: m.table.customer,
    company: m.table.company,
    amount: m.table.amount,
    quantity: m.table.quantity,
    unitPrice: m.table.unitPrice,
    status: m.table.status,
    investor: m.table.investor,
    created: m.table.created,
    funded: m.table.funded,
    shipped: m.table.shipped,
    viewDeal: m.table.viewDeal,
    empty: m.activityEmpty,
  }
}

export function buildPaginationLabels(m: SupplierActivityMessages) {
  return {
    prevPage: m.prevPage,
    nextPage: m.nextPage,
    pagination: m.pagination,
  }
}

export function buildProductPerformanceTableLabels(m: SupplierActivityMessages) {
  return {
    title: m.productPerformanceTitle,
    product: m.table.product,
    category: m.table.category,
    requests: m.productPerformance.requests,
    funded: m.productPerformance.funded,
    conversion: m.productPerformance.conversion,
    financedVolume: m.productPerformance.financedVolume,
    completedVolume: m.productPerformance.completedVolume,
    empty: m.productPerformanceEmpty,
  }
}

export function buildCustomerActivityTableLabels(m: SupplierActivityMessages) {
  return {
    title: m.customerActivityTitle,
    customer: m.table.customer,
    products: m.customerActivity.products,
    requests: m.customerActivity.requests,
    requestValue: m.customerActivity.requestValue,
    funded: m.customerActivity.funded,
    awaiting: m.customerActivity.awaiting,
    lastActivity: m.customerActivity.lastActivity,
    empty: m.customerActivityEmpty,
  }
}
