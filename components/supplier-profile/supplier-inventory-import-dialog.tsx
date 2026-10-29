'use client'

import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/provider'
import {
  applyColumnMapping,
  autoMapHeaders,
  computeImportSummary,
  parseFile,
  validateImportRows,
  type ValidatedRow,
} from '@/lib/supplier-profile/inventory-import-parser'
import type { SupplierProduct } from '@/lib/supplier-profile/types'
import type { NormalizedProduct } from '@/lib/supplier-profile/product-validation'

type SupplierInventoryImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: SupplierProduct[]
  onImport: (products: NormalizedProduct[]) => Promise<boolean>
}

export function SupplierInventoryImportDialog({
  open,
  onOpenChange,
  products,
  onImport,
}: SupplierInventoryImportDialogProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [rows, setRows] = useState<ValidatedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      setIsParsing(false)
      setRows([])
      setFileName('')
      setError('')
      if (inputRef.current) inputRef.current.value = ''
    }
    onOpenChange(nextOpen)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setRows([])
    setFileName(file.name)
    setIsParsing(true)

    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const parsed = await parseFile(file, abortController.signal)
      if (abortController.signal.aborted) return

      if (!parsed.ok) {
        if (parsed.error === 'parse.aborted') return
        setError(t(`supplierProfile.${parsed.error}`))
        return
      }

      const mapped = applyColumnMapping(parsed.rows, autoMapHeaders(parsed.headers))
      const existingSkus = new Set(products.flatMap((product) => (product.sku ? [product.sku] : [])))
      setRows(validateImportRows(mapped, existingSkus))
    } catch (err) {
      if (abortController.signal.aborted) return
      setError(err instanceof Error ? err.message : t('supplierProfile.importFailed'))
    } finally {
      if (!abortController.signal.aborted) {
        setIsParsing(false)
      }
    }
  }

  const summary = computeImportSummary(rows)

  const handleImport = async () => {
    const importable = rows.flatMap((row) => (row.importable && row.product ? [row.product] : []))
    if (importable.length === 0) return
    setIsImporting(true)
    try {
      const success = await onImport(importable)
      if (success) handleOpenChange(false)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : t('supplierProfile.importFailed'))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('supplierProfile.importTitle')}</DialogTitle>
          <DialogDescription>{t('supplierProfile.importDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            disabled={isParsing || isImporting}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={isParsing || isImporting}
            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-8 text-center hover:bg-muted/30 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => inputRef.current?.click()}
          >
            {isParsing ? (
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" aria-hidden />
            ) : fileName ? (
              <FileSpreadsheet className="mb-2 h-8 w-8 text-primary" aria-hidden />
            ) : (
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
            )}
            <span className="font-medium">
              {isParsing ? t('supplierProfile.importParsing') : fileName || t('supplierProfile.importChooseFile')}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">{t('supplierProfile.importFileHint')}</span>
          </button>

          {isParsing && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('supplierProfile.importParsing')}
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {rows.length > 0 && (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <span>{t('supplierProfile.importTotal')}: <strong>{summary.total}</strong></span>
                <span>{t('supplierProfile.importReady')}: <strong>{summary.importable}</strong></span>
                <span>{t('supplierProfile.importInvalid')}: <strong>{summary.invalid}</strong></span>
                <span>{t('supplierProfile.importDuplicates')}: <strong>{summary.duplicateInFile + summary.duplicateInStore}</strong></span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t('supplierProfile.importPreviewHint')}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={isImporting} onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={summary.importable === 0 || isImporting || isParsing}
            onClick={() => void handleImport()}
          >
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t('supplierProfile.importProducts')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
