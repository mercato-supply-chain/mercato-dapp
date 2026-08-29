'use client'

import { Minus, Pencil, Plus, Trash2, MoreVertical, CheckCircle2, PauseCircle, XCircle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/media/product-image'
import { getLocalizedCategoryLabel } from '@/lib/categories'
import { formatCurrency } from '@/lib/format'
import {
  getAvailableQuantity,
  getStockStatus,
  STOCK_STATUS_BADGE_CLASS,
} from '@/lib/supplier-profile/inventory'
import type { SupplierProduct } from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'

type SupplierInventoryTableProps = {
  products: SupplierProduct[]
  stockAdjustingId: string | null
  onAdjustStock: (product: SupplierProduct, delta: number) => void
  onEdit: (product: SupplierProduct) => void
  onDelete: (product: SupplierProduct) => void
  onStatusChange: (product: SupplierProduct, newStatus: 'active' | 'paused' | 'discontinued') => void
}

export function SupplierInventoryTable({
  products,
  stockAdjustingId,
  onAdjustStock,
  onEdit,
  onDelete,
  onStatusChange,
}: SupplierInventoryTableProps) {
  const { t, messages } = useI18n()

  const statusLabel = (status: ReturnType<typeof getStockStatus>) => {
    if (status === 'in_stock') return t('supplierProfile.stockInStock')
    if (status === 'low_stock') return t('supplierProfile.stockLowStock')
    return t('supplierProfile.stockOutOfStock')
  }

  const unitLabel = (unit: string) => {
    const key = `supplierProfile.unit.${unit}` as const
    const translated = t(key)
    return translated === key ? unit : translated
  }

  
  const publicationBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 rounded-md bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400"><CheckCircle2 className="h-3 w-3" /> {t('supplierProfile.statusActive') || 'Active'}</span>
      case 'paused':
        return <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"><PauseCircle className="h-3 w-3" /> {t('supplierProfile.statusPaused') || 'Paused'}</span>
      case 'discontinued':
        return <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400"><XCircle className="h-3 w-3" /> {t('supplierProfile.statusDiscontinued') || 'Discontinued'}</span>
      default:
        return null
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">{t('supplierProfile.tableName')}</th>
            <th className="px-3 py-2.5 font-medium">{t('supplierProfile.tableSku')}</th>
            <th className="px-3 py-2.5 font-medium">{t('supplierProfile.tableCategory')}</th>
            <th className="px-3 py-2.5 font-medium text-right">{t('supplierProfile.tablePriceUnit')}</th>
            <th className="px-3 py-2.5 font-medium text-center">{t('supplierProfile.tableOnHand')}</th>
            <th className="px-3 py-2.5 font-medium text-center">{t('supplierProfile.tableAvailable')}</th>
            <th className="px-3 py-2.5 font-medium text-center">{t('supplierProfile.tablePublication') || 'Publication'}</th>
            <th className="px-3 py-2.5 font-medium">{t('supplierProfile.tableStockStatus')}</th>
            <th className="px-3 py-2.5 font-medium text-right">{t('supplierProfile.tableActions')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const status = getStockStatus(product)
            const available = getAvailableQuantity(product)
            const reserved = Math.max(0, Math.floor(Number(product.reserved_quantity) || 0))
            const adjusting = stockAdjustingId === product.id

            return (
              <tr
                key={product.id}
                className="border-b border-border/50 last:border-0 hover:bg-muted/20"
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5 min-w-[160px]">
                    <ProductImage
                      imageUrl={product.image_url}
                      alt={product.name}
                      size="sm"
                      className="shrink-0 rounded-md"
                    />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug truncate">{product.name}</p>
                      {product.delivery_time ? (
                        <p className="text-xs text-muted-foreground truncate">{product.delivery_time}</p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                  {product.sku || '—'}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {getLocalizedCategoryLabel(product.category, messages)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(product.price_per_unit)}
                  <span className="text-xs text-muted-foreground"> / {unitLabel(product.unit)}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={adjusting}
                      onClick={() => onAdjustStock(product, -1)}
                      aria-label={t('supplierProfile.decreaseStockAria', { name: product.name })}
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <span className="min-w-[2.5rem] text-center font-semibold tabular-nums">
                      {product.stock_quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={adjusting}
                      onClick={() => onAdjustStock(product, 1)}
                      aria-label={t('supplierProfile.increaseStockAria', { name: product.name })}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                  {reserved > 0 ? (
                    <p className="mt-1 text-center text-[10px] text-muted-foreground">
                      {t('supplierProfile.reservedUnits', { count: reserved })}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-center font-semibold tabular-nums">{available}</td>
                <td className="px-3 py-3 text-center">
                  {publicationBadge(product.status)}
                </td>

                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${STOCK_STATUS_BADGE_CLASS[status]}`}
                  >
                    {statusLabel(status)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(product)}
                      aria-label={t('supplierProfile.editAria', { name: product.name })}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(product)}
                      aria-label={t('supplierProfile.deleteAria', { name: product.name })}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {product.status !== 'active' && (
                          <DropdownMenuItem onClick={() => onStatusChange(product, 'active')}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {t('supplierProfile.actionActivate') || 'Activate'}
                          </DropdownMenuItem>
                        )}
                        {product.status !== 'paused' && (
                          <DropdownMenuItem onClick={() => onStatusChange(product, 'paused')}>
                            <PauseCircle className="mr-2 h-4 w-4" />
                            {t('supplierProfile.actionPause') || 'Pause'}
                          </DropdownMenuItem>
                        )}
                        {product.status !== 'discontinued' && (
                          <DropdownMenuItem onClick={() => onStatusChange(product, 'discontinued')} className="text-destructive focus:text-destructive">
                            <XCircle className="mr-2 h-4 w-4" />
                            {t('supplierProfile.actionDiscontinue') || 'Discontinue'}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
