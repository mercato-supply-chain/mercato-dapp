import { describe, expect, test } from 'bun:test'
import {
  getSupplierCommercialState,
  isActiveFinancedSale,
  isOpenFinancingRequest,
  needsSupplierShipment,
} from '@/lib/suppliers/commercial-states'

const base = {
  status: 'seeking_funding',
  investor_id: null,
  funded_at: null,
  funding_expires_at: '2099-01-01T00:00:00.000Z',
  extension_count: 0,
  shipped_at: null,
  delivered_at: null,
}

describe('getSupplierCommercialState', () => {
  test('open financing request', () => {
    expect(getSupplierCommercialState(base)).toBe('financing_request')
  })

  test('expired financing request', () => {
    expect(
      getSupplierCommercialState({
        ...base,
        funding_expires_at: '2020-01-01T00:00:00.000Z',
      }),
    ).toBe('expired')
  })

  test('cancelled deal', () => {
    expect(getSupplierCommercialState({ ...base, status: 'cancelled' })).toBe('cancelled')
  })

  test('completed sale', () => {
    expect(
      getSupplierCommercialState({
        ...base,
        status: 'completed',
        funded_at: '2026-01-01',
      }),
    ).toBe('completed_sale')
  })

  test('needs shipment when funded and not shipped', () => {
    expect(
      getSupplierCommercialState({
        ...base,
        status: 'funded',
        funded_at: '2026-01-01',
        investor_id: 'inv-1',
      }),
    ).toBe('needs_shipment')
  })

  test('in fulfillment when shipped but not delivered', () => {
    expect(
      getSupplierCommercialState({
        ...base,
        status: 'in_progress',
        funded_at: '2026-01-01',
        shipped_at: '2026-01-05T00:00:00.000Z',
      }),
    ).toBe('in_fulfillment')
  })

  test('financed sale when delivered but not completed', () => {
    expect(
      getSupplierCommercialState({
        ...base,
        status: 'in_progress',
        funded_at: '2026-01-01',
        shipped_at: '2026-01-05T00:00:00.000Z',
        delivered_at: '2026-01-10T00:00:00.000Z',
      }),
    ).toBe('financed_sale')
  })
})

describe('helpers', () => {
  test('isOpenFinancingRequest', () => {
    expect(isOpenFinancingRequest(base)).toBe(true)
    expect(
      isOpenFinancingRequest({
        ...base,
        funding_expires_at: '2020-01-01T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  test('isActiveFinancedSale', () => {
    expect(isActiveFinancedSale({ ...base, status: 'funded' })).toBe(true)
    expect(isActiveFinancedSale({ ...base, status: 'completed' })).toBe(false)
  })

  test('needsSupplierShipment', () => {
    expect(
      needsSupplierShipment({
        ...base,
        status: 'funded',
        funded_at: '2026-01-01',
      }),
    ).toBe(true)
    expect(
      needsSupplierShipment({
        ...base,
        status: 'funded',
        shipped_at: '2026-01-05T00:00:00.000Z',
      }),
    ).toBe(false)
  })
})
