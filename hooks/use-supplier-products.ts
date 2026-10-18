'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import {
  EMPTY_PRODUCT_FORM,
  PRODUCT_SELECT,
  type ProductFormState,
  type SupplierProduct,
} from '@/lib/supplier-profile/types'
import { deleteStorageFile } from '@/lib/supplier-profile/storage'
import { useI18n } from '@/lib/i18n/provider'
import { toast } from 'sonner'
import type { NormalizedProduct } from '@/lib/supplier-profile/product-validation'

const PRODUCTS_PAGE_SIZE = 50

type ProductPage = { products: SupplierProduct[]; hasMore: boolean }

export function useSupplierProducts(
  selectedCompanyId: string | null,
  user: { id: string } | null,
) {
  const supabase = useMemo(() => createClient(), [])
  const { t } = useI18n()
  const userId = user?.id

  const getPageKey = useCallback((pageIndex: number, previousPage: ProductPage | null) => {
    if (!selectedCompanyId || !userId || (previousPage && !previousPage.hasMore)) return null
    return ['supplier-products', userId, selectedCompanyId, pageIndex] as const
  }, [selectedCompanyId, userId])

  const fetchPage = useCallback(async ([, , companyId, pageIndex]: readonly [string, string, string, number]): Promise<ProductPage> => {
    const start = pageIndex * PRODUCTS_PAGE_SIZE
    const { data, count, error } = await supabase
      .from('supplier_products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .eq('supplier_id', companyId)
      .order('name')
      .order('id') // unique tiebreaker for stable pagination
      .range(start, start + PRODUCTS_PAGE_SIZE - 1)

    if (error) throw error
    const products = (data ?? []) as SupplierProduct[]
    return {
      products,
      hasMore: count === null ? products.length === PRODUCTS_PAGE_SIZE : start + products.length < count,
    }
  }, [supabase])

  const { data: pages, error: loadError, isValidating, size, setSize, mutate } = useSWRInfinite(
    getPageKey,
    fetchPage,
    {
      revalidateIfStale: false,
      revalidateFirstPage: false,
      shouldRetryOnError: false,
      onError: (error) => console.error('[useSupplierProducts]', error),
    },
  )
  const products = useMemo(() => {
    const seen = new Set<string>()
    return (pages ?? []).flatMap((page) => page.products.filter((product) => {
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    }))
  }, [pages])
  const hasMore = Boolean(selectedCompanyId && user && !loadError && (pages?.at(-1)?.hasMore ?? true))
  const isLoading = Boolean(selectedCompanyId && user && !loadError && (isValidating || !pages))

  // Writes use the same SWR page cache that all mounted catalog consumers read.
  const updateCachedProduct = useCallback(async (id: string, changes: Partial<SupplierProduct>) => {
    await mutate((current) => current?.map((page) => ({
      ...page,
      products: page.products.map((product) => product.id === id ? { ...product, ...changes } : product),
    })), { revalidate: false })
  }, [mutate])

  const refreshProducts = useCallback(async () => {
    await mutate()
  }, [mutate])

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<SupplierProduct | null>(null)
  const [formProduct, setFormProduct] = useState<ProductFormState>(EMPTY_PRODUCT_FORM)
  const [formSaving, setFormSaving] = useState(false)
  const [stockAdjustingId, setStockAdjustingId] = useState<string | null>(null)

  const importProducts = useCallback(async (rows: NormalizedProduct[]) => {
    if (!selectedCompanyId || rows.length === 0) return false
    const response = await fetch('/api/supplier/import-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ companyId: selectedCompanyId, rows }),
    })
    const payload = (await response.json()) as {
      products?: SupplierProduct[]
      error?: string
    }
    if (!response.ok) throw new Error(payload.error ?? 'import.failed')
    await refreshProducts()
    return true
  }, [selectedCompanyId, refreshProducts])

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && pages?.length === size) {
      void setSize(size + 1)
    }
  }, [isLoading, hasMore, pages?.length, size, setSize])

  const openAddDialog = useCallback(() => {
    setFormProduct(EMPTY_PRODUCT_FORM)
    setAddDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((p: SupplierProduct) => {
    const categoryValue = PRODUCT_CATEGORIES.some((c) => c.value === p.category) ? p.category : 'other'
    setFormProduct({
      name: p.name,
      category: categoryValue,
      price_per_unit: String(p.price_per_unit),
      description: p.description ?? '',
      minimum_order: p.minimum_order != null ? String(p.minimum_order) : '',
      delivery_time: p.delivery_time ?? '',
      sku: p.sku ?? '',
      unit: p.unit || 'unit',
      stock_quantity: String(p.stock_quantity ?? 0),
      reorder_point: String(p.reorder_point ?? 0),
      status: p.status || 'active',
      imageFile: null,
      imagePreview: p.image_url ?? null,
    })
    setEditingProduct(p)
  }, [])

  const parseProductForm = useCallback(() => {
    const name = formProduct.name.trim()
    const category = formProduct.category.trim().toLowerCase()
    const price = Number.parseFloat(formProduct.price_per_unit)
    const minOrder = formProduct.minimum_order.trim() ? Number.parseFloat(formProduct.minimum_order) : null
    const deliveryTime = formProduct.delivery_time.trim() || null
    const sku = formProduct.sku.trim() || null
    const unit = formProduct.unit.trim() || 'unit'
    const stockQty = Math.max(0, Math.floor(Number.parseInt(formProduct.stock_quantity, 10) || 0))
    const reorderPoint = Math.max(0, Math.floor(Number.parseInt(formProduct.reorder_point, 10) || 0))
    const status = formProduct.status || 'active'
    return { name, category, price, minOrder, deliveryTime, sku, unit, stockQty, reorderPoint, status }
  }, [formProduct])

  const handleStatusChange = useCallback(async (product: SupplierProduct, newStatus: 'active' | 'paused' | 'discontinued') => {
    try {
      const { error } = await supabase
        .from('supplier_products')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', product.id)
      if (error) throw error
      await updateCachedProduct(product.id, { status: newStatus })
      toast.success(t('supplierProfile.toastStatusUpdated') || 'Status updated')
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastStatusUpdateFail') || 'Failed to update status')
    }
  }, [supabase, t, updateCachedProduct])

  const adjustStock = useCallback(async (product: SupplierProduct, delta: number) => {
    if (!selectedCompanyId) return
    const next = Math.max(0, Math.floor(Number(product.stock_quantity) || 0) + delta)
    if (next < Math.max(0, Math.floor(Number(product.reserved_quantity) || 0))) {
      toast.error(t('supplierProfile.toastStockBelowReserved'))
      return
    }
    setStockAdjustingId(product.id)
    try {
      const { error } = await supabase
        .from('supplier_products')
        .update({ stock_quantity: next, updated_at: new Date().toISOString() })
        .eq('id', product.id)
      if (error) throw error
      await updateCachedProduct(product.id, { stock_quantity: next })
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastStockAdjustFail'))
    } finally {
      setStockAdjustingId(null)
    }
  }, [selectedCompanyId, supabase, t, updateCachedProduct])

  const handleAddProduct = useCallback(async () => {
    if (!user || !selectedCompanyId) return
    const { name, category, price, minOrder, deliveryTime, sku, unit, stockQty, reorderPoint, status } =
      parseProductForm()
    if (!name || !category || Number.isNaN(price) || price <= 0) {
      toast.error(t('supplierProfile.toastProductFields'))
      return
    }
    setFormSaving(true)
    try {
      const { data, error } = await supabase
        .from('supplier_products')
        .insert({
          supplier_id: selectedCompanyId,
          name,
          category,
          price_per_unit: price,
          description: formProduct.description.trim() || null,
          minimum_order: minOrder != null && !Number.isNaN(minOrder) && minOrder >= 0 ? minOrder : null,
          delivery_time: deliveryTime,
          sku,
          unit,
          stock_quantity: stockQty,
          reorder_point: reorderPoint,
          status,
        })
        .select()
        .single()
      if (error) throw error

      if (formProduct.imageFile) {
        const filePath = `${user.id}/${selectedCompanyId}/${data.id}/${formProduct.imageFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, formProduct.imageFile)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath)

        const publicUrl = urlData.publicUrl

        const { error: updateError } = await supabase
          .from('supplier_products')
          .update({ image_url: publicUrl })
          .eq('id', data.id)
        if (updateError) throw updateError
      }

      await refreshProducts()
      setAddDialogOpen(false)
      setFormProduct(EMPTY_PRODUCT_FORM)
      toast.success(t('supplierProfile.toastProductAdded'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastProductAddFail'))
    } finally {
      setFormSaving(false)
    }
  }, [user, selectedCompanyId, parseProductForm, formProduct, supabase, t, refreshProducts])

  const handleUpdateProduct = useCallback(async () => {
    if (!editingProduct || !user || !selectedCompanyId) return
    const { name, category, price, minOrder, deliveryTime, sku, unit, stockQty, reorderPoint, status } =
      parseProductForm()
    if (!name || !category || Number.isNaN(price) || price <= 0) {
      toast.error(t('supplierProfile.toastProductFields'))
      return
    }
    setFormSaving(true)
    try {
      let imageUrlToSave: string | null = editingProduct.image_url

      if (formProduct.imageFile) {
        if (editingProduct.image_url) {
          await deleteStorageFile(supabase, editingProduct.image_url)
        }
        const filePath = `${user.id}/${selectedCompanyId}/${editingProduct.id}/${formProduct.imageFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, formProduct.imageFile, { upsert: true })
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath)
        imageUrlToSave = urlData.publicUrl
      } else if (!formProduct.imagePreview) {
        if (editingProduct.image_url) {
          await deleteStorageFile(supabase, editingProduct.image_url)
        }
        imageUrlToSave = null
      }

      const { error } = await supabase
        .from('supplier_products')
        .update({
          name,
          category,
          price_per_unit: price,
          description: formProduct.description.trim() || null,
          minimum_order: minOrder != null && !Number.isNaN(minOrder) && minOrder >= 0 ? minOrder : null,
          delivery_time: deliveryTime,
          image_url: imageUrlToSave,
          sku,
          unit,
          stock_quantity: stockQty,
          reorder_point: reorderPoint,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProduct.id)
      if (error) throw error

      await refreshProducts() // Name changes can move a product between ordered pages.
      setEditingProduct(null)
      setFormProduct(EMPTY_PRODUCT_FORM)
      toast.success(t('supplierProfile.toastProductUpdated'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastProductUpdateFail'))
    } finally {
      setFormSaving(false)
    }
  }, [editingProduct, user, selectedCompanyId, parseProductForm, formProduct, supabase, t, refreshProducts])

  const handleDeleteProduct = useCallback(async () => {
    if (!deleteProduct || !selectedCompanyId) return
    try {
      if (deleteProduct.image_url) {
        await deleteStorageFile(supabase, deleteProduct.image_url)
      }
      const { error } = await supabase.from('supplier_products').delete().eq('id', deleteProduct.id)
      if (error) throw error
      await refreshProducts()
      setDeleteProduct(null)
      toast.success(t('supplierProfile.toastProductRemoved'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastProductRemoveFail'))
    }
  }, [deleteProduct, selectedCompanyId, supabase, t, refreshProducts])

  return {
    products,
    addDialogOpen,
    setAddDialogOpen,
    editingProduct,
    setEditingProduct,
    deleteProduct,
    setDeleteProduct,
    formProduct,
    setFormProduct,
    formSaving,
    stockAdjustingId,
    openAddDialog,
    openEditDialog,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleStatusChange,
    adjustStock,
    hasMore,
    isLoading,
    loadMore,
    importProducts,
  }
}
