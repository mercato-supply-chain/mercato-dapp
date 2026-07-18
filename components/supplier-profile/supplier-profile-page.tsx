'use client'

import Link from 'next/link'
import { Building2, ClipboardList, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSupplierProfile } from '@/hooks/use-supplier-profile'
import { useI18n } from '@/lib/i18n/provider'
import { SupplierProfileHero } from './supplier-profile-hero'
import { SupplierCompanyList } from './supplier-company-list'
import { SupplierCompanyDetails } from './supplier-company-details'
import { SupplierProductCatalog } from './supplier-product-catalog'
import { SupplierFirstCompany } from './supplier-first-company'
import { SupplierProfileDialogs } from './supplier-profile-dialogs'
import { SupplierReferralCard } from './supplier-referral-card'
import type { CompanyFieldsValues } from './supplier-company-fields'

export function SupplierProfilePage() {
  const { t } = useI18n()
  const sp = useSupplierProfile()

  if (sp.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  const handleCreateCompany = async (fields: CompanyFieldsValues) => {
    try {
      return await sp.createCompany({
        company_name: fields.company_name,
        country: fields.country,
        sector: fields.sector,
        phone: fields.phone,
      })
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string; hint?: string }
      console.error('Error in handleCreateCompany:', e?.message ?? err, {
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
      })
      throw err
    }
  }

  return (
  <>
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
      <SupplierProfileHero
        companiesCount={sp.companies.length}
        productsCount={sp.totalProductsAllCompanies}
      />

      {sp.companies.length === 0 ? (
        <SupplierFirstCompany onCreate={handleCreateCompany} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
          <SupplierCompanyList
            companies={sp.companies}
            productCounts={sp.productCounts}
            selectedId={sp.selectedCompanyId}
            onSelect={(id) => {
              sp.setSelectedCompanyId(id)
              sp.setPage(0)
            }}
            onAddCompany={() => sp.setAddCompanyOpen(true)}
          />

          <div className="min-w-0 rounded-2xl border border-border/70 bg-card shadow-sm">
            {sp.selectedCompany ? (
              <Tabs
                value={sp.activeTab}
                onValueChange={(v) => sp.setActiveTab(v as 'profile' | 'catalog')}
                className="flex flex-col"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
                  <TabsList className="h-9 rounded-full bg-muted/60 p-1">
                    <TabsTrigger value="catalog" className="gap-1.5 rounded-full px-3 text-xs sm:text-sm">
                      <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                      {t('supplierProfile.tabInventory')}
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="gap-1.5 rounded-full px-3 text-xs sm:text-sm">
                      <Building2 className="h-3.5 w-3.5" aria-hidden />
                      {t('supplierProfile.tabProfile')}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="profile" className="mt-0 space-y-6 px-4 py-6 sm:px-6">
                  <SupplierCompanyDetails
                    company={sp.selectedCompany}
                    form={sp.companyForm}
                    onChange={(patch) => sp.setCompanyForm((prev) => ({ ...prev, ...patch }))}
                    isSaving={sp.isSavingBio}
                    onSubmit={sp.handleSaveCompany}
                  />
                  <SupplierReferralCard companyId={sp.selectedCompany.id} />
                </TabsContent>

                <TabsContent value="catalog" className="mt-0 px-4 py-6 sm:px-6">
                  <SupplierProductCatalog
                    companyName={sp.selectedCompany.company_name}
                    products={sp.paginatedProducts}
                    filteredCount={sp.filteredAndSorted.length}
                    inventoryStats={sp.inventoryStats}
                    search={sp.search}
                    onSearchChange={(v) => {
                      sp.setSearch(v)
                      sp.setPage(0)
                    }}
                    categoryFilter={sp.categoryFilter}
                    onCategoryFilterChange={(v) => {
                      sp.setCategoryFilter(v)
                      sp.setPage(0)
                    }}
                    stockFilter={sp.stockFilter}
                    onStockFilterChange={(v) => {
                      sp.setStockFilter(v)
                      sp.setPage(0)
                    }}
                    categoriesFromProducts={sp.categoriesFromProducts}
                    sort={sp.sort}
                    onSortChange={sp.setSort}
                    sortOptions={sp.sortOptions}
                    currentPage={sp.currentPage}
                    totalPages={sp.totalPages}
                    onPageChange={sp.setPage}
                    stockAdjustingId={sp.stockAdjustingId}
                    onAdjustStock={sp.adjustStock}
                    onAddProduct={sp.openAddDialog}
                    onEditProduct={sp.openEditDialog}
                    onDeleteProduct={sp.setDeleteProduct}
                    onClearFilters={sp.clearFilters}
                  />
                </TabsContent>
              </Tabs>
            ) : null}
          </div>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {t('supplierProfile.footerHint')}{' '}
        <Link href="/settings" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t('supplierProfile.settingsLink')}
        </Link>
      </p>
    </div>

    <SupplierProfileDialogs
      addCompanyOpen={sp.addCompanyOpen}
      onAddCompanyOpenChange={sp.setAddCompanyOpen}
      onCreateCompany={handleCreateCompany}
      addDialogOpen={sp.addDialogOpen}
      onAddDialogOpenChange={sp.setAddDialogOpen}
      editingProduct={sp.editingProduct}
      onEditingProductChange={sp.setEditingProduct}
      deleteProduct={sp.deleteProduct}
      onDeleteProductChange={sp.setDeleteProduct}
      formProduct={sp.formProduct}
      onFormProductChange={(patch) => sp.setFormProduct((prev) => ({ ...prev, ...patch }))}
      formSaving={sp.formSaving}
      onAddProduct={sp.handleAddProduct}
      onUpdateProduct={sp.handleUpdateProduct}
      onConfirmDelete={sp.handleDeleteProduct}
    />
  </>
  )
}
