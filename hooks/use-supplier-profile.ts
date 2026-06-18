'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StockFilter } from '@/lib/supplier-profile/inventory'
import { useSupplierCompanies } from './use-supplier-companies'
import { useSupplierProducts } from './use-supplier-products'
import { useInventoryStats } from './use-inventory-stats'

export function useSupplierProfile() {
  const company = useSupplierCompanies()
  const supabase = useMemo(() => createClient(), [])

  const [productCounts, setProductCounts] = useState<Record<string, number>>({})

  const [activeTab, setActiveTab] = useState<'profile' | 'catalog'>('catalog')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [sort, setSort] = useState('name_asc')
  const [page, setPage] = useState(0)

  const [addCompanyOpen, setAddCompanyOpen] = useState(false)

  const product = useSupplierProducts(company.selectedCompanyId, company.user)

  const refreshProductCounts = useCallback(async (companyIds: string[]) => {
    if (companyIds.length === 0) {
      setProductCounts({})
      return
    }
    const { data } = await supabase.from('supplier_products').select('supplier_id').in('supplier_id', companyIds)
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const id = row.supplier_id as string
      counts[id] = (counts[id] ?? 0) + 1
    }
    setProductCounts(counts)
  }, [supabase])

  useEffect(() => {
    if (company.companies.length > 0) {
      refreshProductCounts(company.companies.map((c) => c.id))
    } else {
      setProductCounts({})
    }
  }, [company.companies, refreshProductCounts])

  useEffect(() => {
    const id = company.selectedCompanyId
    if (!id) return
    setProductCounts((prev) => ({
      ...prev,
      [id]: product.products.length,
    }))
  }, [product.products.length, company.selectedCompanyId])

  const totalProductsAllCompanies = useMemo(
    () => Object.values(productCounts).reduce((s, n) => s + n, 0),
    [productCounts],
  )

  const inventory = useInventoryStats(
    product.products,
    search,
    categoryFilter,
    stockFilter,
    sort,
    page,
  )

  const clearFilters = useCallback(() => {
    setSearch('')
    setCategoryFilter('all')
    setStockFilter('all')
    setPage(0)
  }, [])

  return {
    isLoading: company.isLoading,
    isSavingBio: company.isSavingBio,
    companies: company.companies,
    productCounts,
    selectedCompanyId: company.selectedCompanyId,
    setSelectedCompanyId: company.setSelectedCompanyId,
    selectedCompany: company.selectedCompany,
    products: product.products,
    companyForm: company.companyForm,
    setCompanyForm: company.setCompanyForm,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    stockFilter,
    setStockFilter,
    inventoryStats: inventory.inventoryStats,
    stockAdjustingId: product.stockAdjustingId,
    adjustStock: product.adjustStock,
    sort,
    setSort,
    page,
    setPage,
    addDialogOpen: product.addDialogOpen,
    setAddDialogOpen: product.setAddDialogOpen,
    editingProduct: product.editingProduct,
    setEditingProduct: product.setEditingProduct,
    deleteProduct: product.deleteProduct,
    setDeleteProduct: product.setDeleteProduct,
    formProduct: product.formProduct,
    setFormProduct: product.setFormProduct,
    formSaving: product.formSaving,
    addCompanyOpen,
    setAddCompanyOpen,
    sortOptions: inventory.sortOptions,
    categoriesFromProducts: inventory.categoriesFromProducts,
    filteredAndSorted: inventory.filteredAndSorted,
    paginatedProducts: inventory.paginatedProducts,
    totalPages: inventory.totalPages,
    currentPage: inventory.currentPage,
    totalProductsAllCompanies,
    handleSaveCompany: company.handleSaveCompany,
    createCompany: company.createCompany,
    openAddDialog: product.openAddDialog,
    openEditDialog: product.openEditDialog,
    handleAddProduct: product.handleAddProduct,
    handleUpdateProduct: product.handleUpdateProduct,
    handleDeleteProduct: product.handleDeleteProduct,
    clearFilters,
  }
}
