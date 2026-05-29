'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import {
  EMPTY_PRODUCT_FORM,
  PAGE_SIZE,
  type CompanyFormState,
  type ProductFormState,
  type SupplierCompany,
  type SupplierProduct,
} from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'
import { toast } from 'sonner'

export function useSupplierProfile() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { t } = useI18n()

  const [isLoading, setIsLoading] = useState(true)
  const [isSavingBio, setIsSavingBio] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [companies, setCompanies] = useState<SupplierCompany[]>([])
  const [productCounts, setProductCounts] = useState<Record<string, number>>({})
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [products, setProducts] = useState<SupplierProduct[]>([])
  const [companyForm, setCompanyForm] = useState<CompanyFormState>({
    bio: '',
    country: '',
    sector: '',
    phone: '',
  })

  const [activeTab, setActiveTab] = useState<'profile' | 'catalog'>('catalog')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sort, setSort] = useState('name_asc')
  const [page, setPage] = useState(0)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<SupplierProduct | null>(null)
  const [formProduct, setFormProduct] = useState<ProductFormState>(EMPTY_PRODUCT_FORM)
  const [formSaving, setFormSaving] = useState(false)
  const [addCompanyOpen, setAddCompanyOpen] = useState(false)

  const sortOptions = useMemo(
    () =>
      [
        { value: 'name_asc', label: t('supplierProfile.sortNameAz') },
        { value: 'name_desc', label: t('supplierProfile.sortNameZa') },
        { value: 'category_asc', label: t('supplierProfile.sortCategory') },
        { value: 'price_asc', label: t('supplierProfile.sortPriceLow') },
        { value: 'price_desc', label: t('supplierProfile.sortPriceHigh') },
      ] as const,
    [t],
  )

  const refreshProductCounts = useCallback(
    async (companyIds: string[]) => {
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
    },
    [supabase],
  )

  useEffect(() => {
    const load = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (!u) {
        router.push('/auth/login')
        return
      }
      setUser(u)

      const { data: profileData } = await supabase.from('profiles').select('user_type').eq('id', u.id).single()
      if (profileData?.user_type !== 'supplier') {
        router.push('/dashboard')
        return
      }

      const { data: companiesData } = await supabase
        .from('supplier_companies')
        .select('id, company_name, bio, country, sector, phone')
        .eq('owner_id', u.id)
        .order('company_name')

      const companiesList = (companiesData ?? []) as SupplierCompany[]
      setCompanies(companiesList)
      if (companiesList.length > 0) {
        setSelectedCompanyId((prev) => prev || companiesList[0].id)
        await refreshProductCounts(companiesList.map((c) => c.id))
      }
      setIsLoading(false)
    }
    void load()
  }, [router, supabase, refreshProductCounts])

  useEffect(() => {
    if (!selectedCompanyId || !user) return
    const loadProducts = async () => {
      const { data: productsData } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', selectedCompanyId)
        .order('name')
      setProducts((productsData as SupplierProduct[]) ?? [])
    }
    void loadProducts()
    const company = companies.find((c) => c.id === selectedCompanyId)
    setCompanyForm({
      bio: company?.bio ?? '',
      country: company?.country ?? '',
      sector: company?.sector ?? '',
      phone: company?.phone ?? '',
    })
  }, [selectedCompanyId, user, companies, supabase])

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  )

  const categoriesFromProducts = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products],
  )

  const filteredAndSorted = useMemo(() => {
    let list = [...products]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false) ||
          p.category.toLowerCase().includes(q),
      )
    }
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter)
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
      return 0
    })
    return list
  }, [products, search, categoryFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginatedProducts = useMemo(
    () => filteredAndSorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [filteredAndSorted, currentPage],
  )

  const totalProductsAllCompanies = useMemo(
    () => Object.values(productCounts).reduce((s, n) => s + n, 0),
    [productCounts],
  )

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedCompanyId) return
    setIsSavingBio(true)
    try {
      const { error } = await supabase
        .from('supplier_companies')
        .update({
          bio: companyForm.bio,
          country: companyForm.country || null,
          sector: companyForm.sector || null,
          phone: companyForm.phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedCompanyId)
        .eq('owner_id', user.id)
      if (error) throw error
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === selectedCompanyId
            ? {
                ...c,
                bio: companyForm.bio,
                country: companyForm.country || null,
                sector: companyForm.sector || null,
                phone: companyForm.phone.trim() || null,
              }
            : c,
        ),
      )
      toast.success(t('supplierProfile.toastDetailsSaved'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastSaveBioFail'))
    } finally {
      setIsSavingBio(false)
    }
  }

  const createCompany = async (payload: {
    company_name: string
    country: string
    sector: string
    phone: string
  }) => {
    if (!user || !payload.company_name.trim()) return false
    const { data, error } = await supabase
      .from('supplier_companies')
      .insert({
        owner_id: user.id,
        company_name: payload.company_name.trim(),
        country: payload.country || null,
        sector: payload.sector || null,
        phone: payload.phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select('id, company_name, bio, country, sector, phone')
      .single()
    if (error) throw error
    const company = data as SupplierCompany
    setCompanies((prev) => [...prev, company])
    setSelectedCompanyId(company.id)
    setProductCounts((prev) => ({ ...prev, [company.id]: 0 }))
    return true
  }

  const getPathFromUrl = useCallback((url: string) => {
    const marker = '/storage/v1/object/public/products/'
    const index = url.indexOf(marker)
    if (index !== -1) {
      return decodeURIComponent(url.substring(index + marker.length))
    }
    return null
  }, [])

  const deleteStorageFile = useCallback(async (url: string) => {
    const path = getPathFromUrl(url)
    if (path) {
      const { error } = await supabase.storage.from('products').remove([path])
      if (error) {
        console.error('Error deleting file from storage:', error)
      }
    }
  }, [supabase, getPathFromUrl])

  const openAddDialog = () => {
    setFormProduct(EMPTY_PRODUCT_FORM)
    setAddDialogOpen(true)
  }

  const openEditDialog = (p: SupplierProduct) => {
    const categoryValue = PRODUCT_CATEGORIES.some((c) => c.value === p.category) ? p.category : 'other'
    setFormProduct({
      name: p.name,
      category: categoryValue,
      price_per_unit: String(p.price_per_unit),
      description: p.description ?? '',
      minimum_order: p.minimum_order != null ? String(p.minimum_order) : '',
      delivery_time: p.delivery_time ?? '',
      imageFile: null,
      imagePreview: p.image_url ?? null,
    })
    setEditingProduct(p)
  }

  const parseProductForm = () => {
    const name = formProduct.name.trim()
    const category = formProduct.category.trim().toLowerCase()
    const price = Number.parseFloat(formProduct.price_per_unit)
    const minOrder = formProduct.minimum_order.trim() ? Number.parseFloat(formProduct.minimum_order) : null
    const deliveryTime = formProduct.delivery_time.trim() || null
    return { name, category, price, minOrder, deliveryTime }
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedCompanyId) return
    const { name, category, price, minOrder, deliveryTime } = parseProductForm()
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
      setProductCounts((prev) => ({ ...prev, [selectedCompanyId]: (prev[selectedCompanyId] ?? 0) + 1 }))
      setAddDialogOpen(false)
      setFormProduct(EMPTY_PRODUCT_FORM)
      toast.success(t('supplierProfile.toastProductAdded'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastProductAddFail'))
    } finally {
      setFormSaving(false)
    }
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct || !user || !selectedCompanyId) return
    const { name, category, price, minOrder, deliveryTime } = parseProductForm()
    if (!name || !category || Number.isNaN(price) || price <= 0) {
      toast.error(t('supplierProfile.toastProductFields'))
      return
    }
    setFormSaving(true)
    try {
      let imageUrlToSave: string | null = editingProduct.image_url

      if (formProduct.imageFile) {
        if (editingProduct.image_url) {
          await deleteStorageFile(editingProduct.image_url)
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
          await deleteStorageFile(editingProduct.image_url)
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
  }

  const handleDeleteProduct = async () => {
    if (!deleteProduct || !selectedCompanyId) return
    try {
      if (deleteProduct.image_url) {
        await deleteStorageFile(deleteProduct.image_url)
      }
      const { error } = await supabase.from('supplier_products').delete().eq('id', deleteProduct.id)
      if (error) throw error
      setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id))
      setProductCounts((prev) => ({
        ...prev,
        [selectedCompanyId]: Math.max(0, (prev[selectedCompanyId] ?? 1) - 1),
      }))
      setDeleteProduct(null)
      toast.success(t('supplierProfile.toastProductRemoved'))
    } catch (err) {
      console.error(err)
      toast.error(t('supplierProfile.toastProductRemoveFail'))
    }
  }

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setPage(0)
  }

  return {
    isLoading,
    isSavingBio,
    companies,
    productCounts,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedCompany,
    products,
    companyForm,
    setCompanyForm,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    sort,
    setSort,
    page,
    setPage,
    addDialogOpen,
    setAddDialogOpen,
    editingProduct,
    setEditingProduct,
    deleteProduct,
    setDeleteProduct,
    formProduct,
    setFormProduct,
    formSaving,
    addCompanyOpen,
    setAddCompanyOpen,
    sortOptions,
    categoriesFromProducts,
    filteredAndSorted,
    paginatedProducts,
    totalPages,
    currentPage,
    totalProductsAllCompanies,
    handleSaveCompany,
    createCompany,
    openAddDialog,
    openEditDialog,
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    clearFilters,
  }
}
