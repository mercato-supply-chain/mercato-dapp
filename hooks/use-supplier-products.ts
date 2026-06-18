'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

export function useSupplierProducts(
  selectedCompanyId: string | null,
  user: { id: string } | null,
) {
  const supabase = useMemo(() => createClient(), [])
  const { t } = useI18n()

  const [products, setProducts] = useState<SupplierProduct[]>([])

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<SupplierProduct | null>(null)
  const [formProduct, setFormProduct] = useState<ProductFormState>(EMPTY_PRODUCT_FORM)
  const [formSaving, setFormSaving] = useState(false)
  const [stockAdjustingId, setStockAdjustingId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCompanyId || !user) {
      setProducts([])
      return
    }
    const loadProducts = async () => {
      const { data: productsData } = await supabase
        .from('supplier_products')
        .select(PRODUCT_SELECT)
        .eq('supplier_id', selectedCompanyId)
        .order('name')
      setProducts((productsData as SupplierProduct[]) ?? [])
    }
    void loadProducts()
  }, [selectedCompanyId, user, supabase])

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
    return { name, category, price, minOrder, deliveryTime, sku, unit, stockQty, reorderPoint }
  }, [formProduct])

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
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, stock_quantity: next } : p)),
      )
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastStockAdjustFail'))
    } finally {
      setStockAdjustingId(null)
    }
  }, [selectedCompanyId, supabase, t])

  const handleAddProduct = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedCompanyId) return
    const { name, category, price, minOrder, deliveryTime, sku, unit, stockQty, reorderPoint } =
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
        })
        .select()
        .single()
      if (error) throw error

      let finalProduct = { ...data } as SupplierProduct

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

        finalProduct.image_url = publicUrl
      }

      setProducts((prev) => [...prev, finalProduct])
      setAddDialogOpen(false)
      setFormProduct(EMPTY_PRODUCT_FORM)
      toast.success(t('supplierProfile.toastProductAdded'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastProductAddFail'))
    } finally {
      setFormSaving(false)
    }
  }, [user, selectedCompanyId, parseProductForm, formProduct, supabase, t])

  const handleUpdateProduct = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct || !user || !selectedCompanyId) return
    const { name, category, price, minOrder, deliveryTime, sku, unit, stockQty, reorderPoint } =
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProduct.id)
      if (error) throw error

      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
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
              }
            : p,
        ),
      )
      setEditingProduct(null)
      setFormProduct(EMPTY_PRODUCT_FORM)
      toast.success(t('supplierProfile.toastProductUpdated'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastProductUpdateFail'))
    } finally {
      setFormSaving(false)
    }
  }, [editingProduct, user, selectedCompanyId, parseProductForm, formProduct, supabase, t])

  const handleDeleteProduct = useCallback(async () => {
    if (!deleteProduct || !selectedCompanyId) return
    try {
      if (deleteProduct.image_url) {
        await deleteStorageFile(supabase, deleteProduct.image_url)
      }
      const { error } = await supabase.from('supplier_products').delete().eq('id', deleteProduct.id)
      if (error) throw error
      setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id))
      setDeleteProduct(null)
      toast.success(t('supplierProfile.toastProductRemoved'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastProductRemoveFail'))
    }
  }, [deleteProduct, selectedCompanyId, supabase, t])

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
    adjustStock,
  }
}
