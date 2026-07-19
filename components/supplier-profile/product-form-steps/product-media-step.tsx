'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ProductFormState } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'

export function ProductMediaStep({
  formProduct,
  onChange,
}: {
  formProduct: ProductFormState
  onChange: (patch: Partial<ProductFormState>) => void
}) {
  const { t } = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error(t('supplierProfile.toastImageTypeError'))
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(t('supplierProfile.toastImageSizeError'))
      return
    }

    if (formProduct.imagePreview && formProduct.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(formProduct.imagePreview)
    }

    const previewUrl = URL.createObjectURL(file)
    onChange({ imageFile: file, imagePreview: previewUrl })
  }

  const handleRemoveImage = () => {
    if (formProduct.imagePreview && formProduct.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(formProduct.imagePreview)
    }
    onChange({ imageFile: null, imagePreview: null })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">{t('supplierProfile.wizardStepMediaTitle')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('supplierProfile.wizardStepMediaHint')}
        </p>
      </div>
      <div className="space-y-2">
        <Label>{t('supplierProfile.formProductImage')}</Label>
        {formProduct.imagePreview ? (
          <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/40">
              <img
                src={formProduct.imagePreview}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">
                {formProduct.imageFile
                  ? formProduct.imageFile.name
                  : t('supplierProfile.formProductImage')}
              </p>
              <p className="text-xs text-muted-foreground">
                {formProduct.imageFile
                  ? `${(formProduct.imageFile.size / (1024 * 1024)).toFixed(2)} MB`
                  : ''}
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-1 h-8 rounded-full text-xs"
                onClick={handleRemoveImage}
              >
                {t('supplierProfile.formProductImageRemove')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFile(file)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/20 bg-muted/5 hover:border-primary/50 hover:bg-muted/10'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="hidden text-center text-sm font-medium text-foreground sm:block">
              {t('supplierProfile.formProductImageSelect')}
            </p>
            <p className="text-center text-sm font-medium text-foreground sm:hidden">
              {t('supplierProfile.formProductImageSelectMobile')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('supplierProfile.formProductImageHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
