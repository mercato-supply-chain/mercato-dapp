'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ProductFormState, SupplierProduct } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'
import { toast } from 'sonner'
import {
  SupplierCompanyFields,
  type CompanyFieldsValues,
} from './supplier-company-fields'
import { SupplierProductForm } from './supplier-product-form'

const EMPTY_COMPANY: CompanyFieldsValues = {
  company_name: '',
  phone: '',
  country: '',
  sector: '',
}

type SupplierProfileDialogsProps = {
  addCompanyOpen: boolean
  onAddCompanyOpenChange: (open: boolean) => void
  onCreateCompany: (payload: CompanyFieldsValues) => Promise<boolean>
  addDialogOpen: boolean
  onAddDialogOpenChange: (open: boolean) => void
  editingProduct: SupplierProduct | null
  onEditingProductChange: (p: SupplierProduct | null) => void
  deleteProduct: SupplierProduct | null
  onDeleteProductChange: (p: SupplierProduct | null) => void
  formProduct: ProductFormState
  onFormProductChange: (patch: Partial<ProductFormState>) => void
  formSaving: boolean
  onAddProduct: () => void
  onUpdateProduct: () => void
  onConfirmDelete: () => void
}

export function SupplierProfileDialogs({
  addCompanyOpen,
  onAddCompanyOpenChange,
  onCreateCompany,
  addDialogOpen,
  onAddDialogOpenChange,
  editingProduct,
  onEditingProductChange,
  deleteProduct,
  onDeleteProductChange,
  formProduct,
  onFormProductChange,
  formSaving,
  onAddProduct,
  onUpdateProduct,
  onConfirmDelete,
}: SupplierProfileDialogsProps) {
  const { t } = useI18n()
  const [companyFields, setCompanyFields] = useState<CompanyFieldsValues>(EMPTY_COMPANY)
  const [companySaving, setCompanySaving] = useState(false)

  const resetCompanyForm = () => setCompanyFields(EMPTY_COMPANY)

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyFields.company_name.trim()) return
    setCompanySaving(true)
    try {
      const ok = await onCreateCompany(companyFields)
      if (ok) {
        toast.success(t('supplierProfile.toastCompanyAdded'))
        onAddCompanyOpenChange(false)
        resetCompanyForm()
      }
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string; hint?: string }
      console.error('Error adding supplier company:', e?.message ?? err, {
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
      })
      toast.error(t('supplierProfile.toastCompanyAddFail'))
    } finally {
      setCompanySaving(false)
    }
  }

  return (
    <>
      <Dialog
        open={addCompanyOpen}
        onOpenChange={(open) => {
          onAddCompanyOpenChange(open)
          if (!open) resetCompanyForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('supplierProfile.dialogAddCompanyTitle')}</DialogTitle>
            <DialogDescription>{t('supplierProfile.dialogAddCompanyDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCompany}>
            <SupplierCompanyFields
              idPrefix="dialog"
              values={companyFields}
              onChange={(patch) => setCompanyFields((prev) => ({ ...prev, ...patch }))}
            />
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => onAddCompanyOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={companySaving || !companyFields.company_name.trim()}>
                {companySaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t('supplierProfile.adding')}
                  </>
                ) : (
                  t('supplierProfile.addCompany')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={onAddDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('supplierProfile.dialogAddProductTitle')}</DialogTitle>
            <DialogDescription>{t('supplierProfile.dialogAddProductDescription')}</DialogDescription>
          </DialogHeader>
          <SupplierProductForm
            formProduct={formProduct}
            onChange={onFormProductChange}
            formSaving={formSaving}
            onSubmit={onAddProduct}
            onCancel={() => onAddDialogOpenChange(false)}
            submitLabel={t('supplierProfile.addProduct')}
            submittingLabel={t('supplierProfile.adding')}
            resetKey={addDialogOpen}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingProduct}
        onOpenChange={(open) => {
          if (!open) onEditingProductChange(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('supplierProfile.dialogEditProductTitle')}</DialogTitle>
            <DialogDescription>{t('supplierProfile.dialogEditProductDescription')}</DialogDescription>
          </DialogHeader>
          <SupplierProductForm
            formProduct={formProduct}
            onChange={onFormProductChange}
            formSaving={formSaving}
            onSubmit={onUpdateProduct}
            onCancel={() => onEditingProductChange(null)}
            submitLabel={t('supplierProfile.saveChanges')}
            submittingLabel={t('supplierProfile.savingDetails')}
            resetKey={editingProduct?.id ?? 'closed'}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !open && onDeleteProductChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('supplierProfile.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('supplierProfile.deleteDescription', { name: deleteProduct?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('supplierProfile.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
