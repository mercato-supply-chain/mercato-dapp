'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCategoryLabel } from '@/lib/categories'
import { formatCurrency } from '@/lib/format'
import type { SupplierProduct } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'

type SupplierProductCardProps = {
  product: SupplierProduct
  onEdit: () => void
  onDelete: () => void
}

export function SupplierProductCard({ product, onEdit, onDelete }: SupplierProductCardProps) {
  const { t } = useI18n()

  return (
    <article className="flex flex-col rounded-2xl border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md overflow-hidden">
      {product.image_url && (
        <div className="relative h-40 w-full shrink-0 border-b border-border/60 bg-muted/20">
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium leading-snug">{product.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{getCategoryLabel(product.category)}</p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              aria-label={t('supplierProfile.editAria', { name: product.name })}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              aria-label={t('supplierProfile.deleteAria', { name: product.name })}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xl font-semibold tabular-nums tracking-tight">
          {formatCurrency(product.price_per_unit)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ unit</span>
        </p>

        <dl className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
          {product.minimum_order != null && (
            <div className="flex justify-between gap-2">
              <dt>{t('supplierProfile.tableMinOrder')}</dt>
              <dd className="font-medium text-foreground">{formatCurrency(product.minimum_order)}</dd>
            </div>
          )}
          {product.delivery_time && (
            <div className="flex justify-between gap-2">
              <dt>{t('supplierProfile.tableDelivery')}</dt>
              <dd className="truncate font-medium text-foreground">{product.delivery_time}</dd>
            </div>
          )}
        </dl>

        {product.description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        )}
      </div>
    </article>
  )
}
