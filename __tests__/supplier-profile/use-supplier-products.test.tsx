import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { EMPTY_PRODUCT_FORM, type SupplierProduct } from '@/lib/supplier-profile/types'

const requests: Array<{ companyId: string; start: number; end: number }> = []
const productsByCompany: Record<string, SupplierProduct[]> = {}
let holdCompany: string | null = null
let releaseHeldRequest: (() => void) | null = null

function product(companyId: string, index: number): SupplierProduct {
  return {
    id: `${companyId}-${index}`,
    supplier_id: companyId,
    name: `Product ${String(index).padStart(3, '0')}`,
    category: 'other',
    price_per_unit: 10,
    description: null,
    minimum_order: null,
    delivery_time: null,
    image_url: null,
    sku: null,
    unit: 'unit',
    stock_quantity: 5,
    reserved_quantity: 0,
    reorder_point: 0,
    status: 'active',
  }
}

mock.module('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => {
        let companyId = ''
        return {
          eq(_column: string, value: string) { companyId = value; return this },
          order() { return this },
          async range(start: number, end: number) {
            requests.push({ companyId, start, end })
            if (companyId === holdCompany) {
              await new Promise<void>((resolve) => { releaseHeldRequest = resolve })
            }
            const rows = [...(productsByCompany[companyId] ?? [])].sort(
              (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
            )
            return { data: rows.slice(start, end + 1), count: rows.length, error: null }
          },
        }
      },
      update(changes: Partial<SupplierProduct>) {
        return {
          async eq(_column: string, id: string) {
            for (const rows of Object.values(productsByCompany)) {
              const row = rows.find((item) => item.id === id)
              if (row) Object.assign(row, changes)
            }
            return { error: null }
          },
        }
      },
      insert(values: Partial<SupplierProduct> & { supplier_id: string }) {
        const created = { ...product(values.supplier_id, 999), ...values }
        productsByCompany[values.supplier_id] ??= []
        productsByCompany[values.supplier_id].push(created)
        return { select: () => ({ single: async () => ({ data: created, error: null }) }) }
      },
      delete() {
        return {
          async eq(_column: string, id: string) {
            for (const [companyId, rows] of Object.entries(productsByCompany)) {
              productsByCompany[companyId] = rows.filter((item) => item.id !== id)
            }
            return { error: null }
          },
        }
      },
    }),
  }),
}))
mock.module('@/lib/i18n/provider', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import { useSupplierProducts } from '@/hooks/use-supplier-products'

const user = { id: 'supplier-user' }

function sharedWrapper() {
  const cache = new Map()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <SWRConfig value={{ provider: () => cache, dedupingInterval: 60_000 }}>{children}</SWRConfig>
  }
}

beforeEach(() => {
  requests.length = 0
  for (const key of Object.keys(productsByCompany)) delete productsByCompany[key]
  holdCompany = null
  releaseHeldRequest = null
})

afterEach(() => cleanup())

describe('useSupplierProducts shared pages', () => {
  test('deduplicates consumers and remounts, paginates, and shares status and delete mutations', async () => {
    productsByCompany.a = Array.from({ length: 51 }, (_, index) => product('a', index))
    const wrapper = sharedWrapper()
    const first = renderHook(() => useSupplierProducts('a', user), { wrapper })
    const second = renderHook(() => useSupplierProducts('a', user), { wrapper })

    await waitFor(() => expect(first.result.current.products).toHaveLength(50))
    expect(second.result.current.products).toHaveLength(50)
    expect(requests).toEqual([{ companyId: 'a', start: 0, end: 49 }])

    act(() => first.result.current.loadMore())
    await waitFor(() => expect(first.result.current.products).toHaveLength(51))
    expect(new Set(first.result.current.products.map((item) => item.id)).size).toBe(51)
    expect(first.result.current.hasMore).toBe(false)
    expect(requests).toHaveLength(2)

    await act(async () => first.result.current.handleStatusChange(first.result.current.products[0], 'paused'))
    await waitFor(() => expect(second.result.current.products[0].status).toBe('paused'))
    expect(requests).toHaveLength(2)

    act(() => first.result.current.setDeleteProduct(first.result.current.products[0]))
    await act(async () => first.result.current.handleDeleteProduct())
    await waitFor(() => expect(first.result.current.products).toHaveLength(50))
    expect(first.result.current.products.some((item) => item.id === 'a-0')).toBe(false)
    expect(second.result.current.products.some((item) => item.id === 'a-0')).toBe(false)

    first.unmount()
    second.unmount()
    const remounted = renderHook(() => useSupplierProducts('a', user), { wrapper })
    await waitFor(() => expect(remounted.result.current.products).toHaveLength(50))
    // The first page now contains the entire catalog, so SWR skips the old second page.
    expect(requests).toHaveLength(3)
  })

  test('ignores a previous company response after switching companies', async () => {
    productsByCompany.a = [product('a', 0)]
    productsByCompany.b = [product('b', 0)]
    holdCompany = 'a'
    const hook = renderHook(({ companyId }) => useSupplierProducts(companyId, user), {
      wrapper: sharedWrapper(),
      initialProps: { companyId: 'a' },
    })
    await waitFor(() => expect(requests).toHaveLength(1))
    hook.rerender({ companyId: 'b' })
    await waitFor(() => expect(hook.result.current.products.map((item) => item.id)).toEqual(['b-0']))

    await act(async () => { releaseHeldRequest?.() })
    expect(hook.result.current.products.map((item) => item.id)).toEqual(['b-0'])
  })

  test('refreshes ordered pages after edit and add, and updates stock in the shared cache', async () => {
    productsByCompany.a = Array.from({ length: 51 }, (_, index) => product('a', index))
    const wrapper = sharedWrapper()
    const first = renderHook(() => useSupplierProducts('a', user), { wrapper })
    const second = renderHook(() => useSupplierProducts('a', user), { wrapper })
    await waitFor(() => expect(first.result.current.products).toHaveLength(50))
    act(() => first.result.current.loadMore())
    await waitFor(() => expect(first.result.current.products).toHaveLength(51))

    await act(async () => first.result.current.adjustStock(first.result.current.products[0], 3))
    await waitFor(() => expect(second.result.current.products[0].stock_quantity).toBe(8))
    expect(requests).toHaveLength(2)

    act(() => {
      first.result.current.openEditDialog(first.result.current.products[0])
      first.result.current.setFormProduct((form) => ({ ...form, name: 'ZZZ Product' }))
    })
    await act(async () => first.result.current.handleUpdateProduct())
    await waitFor(() => expect(first.result.current.products.at(-1)?.id).toBe('a-0'))
    expect(new Set(first.result.current.products.map((item) => item.id)).size).toBe(51)

    act(() => first.result.current.setFormProduct({
      ...EMPTY_PRODUCT_FORM,
      name: 'AAA Product',
      category: 'other',
      price_per_unit: '10',
    }))
    await act(async () => first.result.current.handleAddProduct())
    await waitFor(() => expect(first.result.current.products).toHaveLength(52))
    expect(first.result.current.products[0].id).toBe('a-999')
    expect(new Set(first.result.current.products.map((item) => item.id)).size).toBe(52)
    expect(second.result.current.products[0].id).toBe('a-999')
  })
})
