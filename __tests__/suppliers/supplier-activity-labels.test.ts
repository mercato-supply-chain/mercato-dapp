import { describe, expect, test } from 'bun:test'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  buildActivityTableLabels,
  buildCustomerActivityTableLabels,
  buildFiltersFormLabels,
  buildPaginationLabels,
  buildProductPerformanceTableLabels,
  buildSummaryCardLabels,
  getSupplierActivityStateLabels,
} from '@/lib/suppliers/supplier-activity-labels'

const m = getDictionary('en').supplierActivity

describe('supplier-activity-labels', () => {
  test('getSupplierActivityStateLabels returns the states map', () => {
    expect(getSupplierActivityStateLabels(m)).toBe(m.states)
    expect(getSupplierActivityStateLabels(m).needs_shipment).toBe(m.states.needs_shipment)
  })

  test('buildSummaryCardLabels maps the five summary fields', () => {
    expect(buildSummaryCardLabels(m)).toEqual({
      openRequests: m.summary.openRequests,
      activeFinanced: m.summary.activeFinanced,
      completedFinanced: m.summary.completedFinanced,
      pendingShipments: m.summary.pendingShipments,
      totalVolume: m.summary.totalVolume,
    })
  })

  test('buildFiltersFormLabels maps filter and action labels', () => {
    const labels = buildFiltersFormLabels(m)
    expect(labels.company).toBe(m.filters.company)
    expect(labels.apply).toBe(m.filters.apply)
    expect(labels.clear).toBe(m.filters.clear)
  })

  test('buildActivityTableLabels reuses the shared table labels and activity title/empty text', () => {
    const labels = buildActivityTableLabels(m)
    expect(labels.title).toBe(m.activityTitle)
    expect(labels.empty).toBe(m.activityEmpty)
    expect(labels.product).toBe(m.table.product)
    expect(labels.viewDeal).toBe(m.table.viewDeal)
  })

  test('buildPaginationLabels maps pagination text', () => {
    expect(buildPaginationLabels(m)).toEqual({
      prevPage: m.prevPage,
      nextPage: m.nextPage,
      pagination: m.pagination,
    })
  })

  test('buildProductPerformanceTableLabels reuses shared table labels', () => {
    const labels = buildProductPerformanceTableLabels(m)
    expect(labels.title).toBe(m.productPerformanceTitle)
    expect(labels.empty).toBe(m.productPerformanceEmpty)
    expect(labels.category).toBe(m.table.category)
  })

  test('buildCustomerActivityTableLabels reuses shared customer label and empty text', () => {
    const labels = buildCustomerActivityTableLabels(m)
    expect(labels.title).toBe(m.customerActivityTitle)
    expect(labels.empty).toBe(m.customerActivityEmpty)
    expect(labels.customer).toBe(m.table.customer)
  })
})
