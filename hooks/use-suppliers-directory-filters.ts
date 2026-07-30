'use client'

import { useMemo, useState } from 'react'
import {
  computeSupplierStats,
  filterSuppliers,
  hasActiveSupplierFilters,
  type Supplier,
} from '@/lib/suppliers/directory-utils'

export function useSuppliersDirectoryFilters(suppliers: Supplier[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [selectedSector, setSelectedSector] = useState('all')

  const filteredSuppliers = useMemo(
    () =>
      filterSuppliers(suppliers, {
        searchQuery,
        selectedCategory,
        selectedCountry,
        selectedSector,
      }),
    [suppliers, searchQuery, selectedCategory, selectedCountry, selectedSector]
  )

  const stats = useMemo(() => computeSupplierStats(suppliers), [suppliers])

  const hasActiveFilters = hasActiveSupplierFilters({
    searchQuery,
    selectedCategory,
    selectedCountry,
    selectedSector,
  })

  const clearAll = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedCountry('all')
    setSelectedSector('all')
  }

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedCountry,
    setSelectedCountry,
    selectedSector,
    setSelectedSector,
    filteredSuppliers,
    stats,
    hasActiveFilters,
    clearAll,
  }
}
