'use client'

import { useMemo } from 'react'
import {
  computeInventoryStats,
  getAvailableQuantity,
  productMatchesStockFilter,
  type StockFilter,
} from '@/lib/supplier-profile/inventory'
import { PAGE_SIZE, type SupplierProduct } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'

export function useInventoryStats(
  products: SupplierProduct[],
  search: string,
  categoryFilter: string,
  stockFilter: StockFilter,
  sort: string,
  page: number,
) {
  const { t } = useI18n()

  const sortOptions = useMemo(
    () =>
      [
        { value: 'name_asc', label: t('supplierProfile.sortNameAz') },
        { value: 'name_desc', label: t('supplierProfile.sortNameZa') },
        { value: 'category_asc', label: t('supplierProfile.sortCategory') },
        { value: 'price_asc', label: t('supplierProfile.sortPriceLow') },
        { value: 'price_desc', label: t('supplierProfile.sortPriceHigh') },
        { value: 'stock_asc', label: t('supplierProfile.sortStockLow') },
        { value: 'stock_desc', label: t('supplierProfile.sortStockHigh') },
      ] as const,
    [t],
  )

  const categoriesFromProducts = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products],
  )

  const inventoryStats = useMemo(() => computeInventoryStats(products), [products])

  const filteredAndSorted = useMemo(() => {
    let list = [...products]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku?.toLowerCase().includes(q) ?? false) ||
          (p.description?.toLowerCase().includes(q) ?? false) ||
          p.category.toLowerCase().includes(q),
      )
    }
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter)
    }
    if (stockFilter !== 'all') {
      list = list.filter((p) => productMatchesStockFilter(p, stockFilter))
    }
    const [field, dir] = sort.includes('_') ? sort.split('_') : ['name', 'asc']
    list.sort((a, b) => {
      if (field === 'name') {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        return dir === 'asc' ? cmp : -cmp
      }
      if (field === 'category') {
        const cmp = a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
        return dir === 'asc' ? cmp : -cmp
      }
      if (field === 'price') {
        const cmp = Number(a.price_per_unit) - Number(b.price_per_unit)
        return dir === 'asc' ? cmp : -cmp
      }
      if (field === 'stock') {
        const cmp = getAvailableQuantity(a) - getAvailableQuantity(b)
        return dir === 'asc' ? cmp : -cmp
      }
      return 0
    })
    return list
  }, [products, search, categoryFilter, stockFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)

  const paginatedProducts = useMemo(
    () => filteredAndSorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [filteredAndSorted, currentPage],
  )

  return {
    inventoryStats,
    filteredAndSorted,
    paginatedProducts,
    categoriesFromProducts,
    totalPages,
    currentPage,
    sortOptions,
  }
}
