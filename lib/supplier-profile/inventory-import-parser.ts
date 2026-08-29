/**
 * Inventory import parser — CSV and XLSX file ingestion.
 *
 * Browser-safe: no server-only imports.
 * Parses a File object into rows, maps headers to product fields,
 * and validates each row against the shared validation module.
 *
 * Limits (v1):
 *   - File size: 5 MB
 *   - Row count: 1 000 rows after header
 *   - Accepted extensions: .csv, .xlsx
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { normalizeCategory, normalizeSku, validateProduct } from './product-validation'
import type { NormalizedProduct } from './product-validation'

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

export const IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
export const IMPORT_MAX_ROWS = 1_000

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

/** Canonical product fields that can be mapped from a column. */
export const IMPORTABLE_FIELDS = [
  'name',
  'category',
  'price_per_unit',
  'description',
  'minimum_order',
  'delivery_time',
  'sku',
  'unit',
  'stock_quantity',
  'reorder_point',
] as const

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number]

/** Required fields — rows without these will always fail validation. */
export const REQUIRED_FIELDS: ImportableField[] = ['name', 'category', 'price_per_unit']

// Normalised header → field mapping (lower, strip punctuation/spaces)
const HEADER_ALIASES: Record<string, ImportableField> = {
  // name
  name: 'name',
  productname: 'name',
  'product name': 'name',
  producto: 'name',
  nombre: 'name',
  // category
  category: 'category',
  categoría: 'category',
  categoria: 'category',
  type: 'category',
  tipo: 'category',
  // price_per_unit
  price_per_unit: 'price_per_unit',
  price: 'price_per_unit',
  precio: 'price_per_unit',
  priceperunit: 'price_per_unit',
  'price per unit': 'price_per_unit',
  'precio por unidad': 'price_per_unit',
  unit_price: 'price_per_unit',
  unitprice: 'price_per_unit',
  // description
  description: 'description',
  descripción: 'description',
  descripcion: 'description',
  desc: 'description',
  // minimum_order
  minimum_order: 'minimum_order',
  minimumorder: 'minimum_order',
  'minimum order': 'minimum_order',
  'pedido mínimo': 'minimum_order',
  min_order: 'minimum_order',
  minorder: 'minimum_order',
  // delivery_time
  delivery_time: 'delivery_time',
  deliverytime: 'delivery_time',
  'delivery time': 'delivery_time',
  'tiempo de entrega': 'delivery_time',
  delivery: 'delivery_time',
  // sku
  sku: 'sku',
  code: 'sku',
  'product code': 'sku',
  'código': 'sku',
  codigo: 'sku',
  'internal code': 'sku',
  // unit
  unit: 'unit',
  units: 'unit',
  'unit of measure': 'unit',
  'unidad de medida': 'unit',
  unidad: 'unit',
  // stock_quantity
  stock_quantity: 'stock_quantity',
  stock: 'stock_quantity',
  quantity: 'stock_quantity',
  cantidad: 'stock_quantity',
  'on hand': 'stock_quantity',
  inventory: 'stock_quantity',
  inventario: 'stock_quantity',
  // reorder_point
  reorder_point: 'reorder_point',
  reorderpoint: 'reorder_point',
  'reorder point': 'reorder_point',
  'punto de reorden': 'reorder_point',
  reorder: 'reorder_point',
}

function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_\-\s]+/g, ' ')
}

/** Given a list of raw column headers, return the best-guess field mapping. */
export function autoMapHeaders(rawHeaders: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const usedFields = new Set<ImportableField>()

  for (const header of rawHeaders) {
    // Try exact normalised key first
    const key = normalizeHeaderKey(header)
    let field = HEADER_ALIASES[key]

    // Also try without spaces
    if (!field) {
      field = HEADER_ALIASES[key.replace(/ /g, '')]
    }

    if (field && !usedFields.has(field)) {
      mapping[header] = field
      usedFields.add(field)
    }
  }

  return mapping
}

/**
 * column header → ImportableField (or undefined to skip).
 * The user can override this in the UI.
 */
export type ColumnMapping = Record<string, ImportableField | undefined>

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type ParsedRow = {
  /** 1-based row index in source file (excluding header). */
  sourceRow: number
  /** Raw cell values keyed by column header. */
  raw: Record<string, string>
  /** Mapped and normalised fields (populated after mapping phase). */
  mapped?: Record<ImportableField, string>
}

export type ValidatedRow = ParsedRow & {
  /** Whether validation passed. */
  valid: boolean
  /** Normalised product ready for insert (only when valid). */
  product?: NormalizedProduct
  /** Validation error keys (empty when valid). */
  errors: string[]
  /** Whether this row is a duplicate of another row in the file (by SKU). */
  duplicateInFile: boolean
  /** Whether this row's SKU already exists in the supplier's stored products. */
  duplicateInStore: boolean
  /** Duplicate warning for name+category collision when no SKU. */
  nameCollision: boolean
  /** Row is eligible for import: valid && !duplicateInFile && !duplicateInStore. */
  importable: boolean
}

// ---------------------------------------------------------------------------
// File parsing (raw rows)
// ---------------------------------------------------------------------------

export type ParseFileResult =
  | { ok: true; headers: string[]; rows: ParsedRow[] }
  | { ok: false; error: string }

function toCsvRows(csvText: string): { headers: string[]; rows: ParsedRow[] } | { error: string } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (result.errors.length > 0 && result.data.length === 0) {
    return { error: 'parse.csvParseError' }
  }

  const headers = result.meta.fields ?? []
  const rows: ParsedRow[] = result.data.slice(0, IMPORT_MAX_ROWS).map(
    (row, i) => ({
      sourceRow: i + 1,
      raw: Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, String(v ?? '').trim()]),
      ),
    }),
  )

  return { headers, rows }
}

function toXlsxRows(buffer: ArrayBuffer): { headers: string[]; rows: ParsedRow[] } | { error: string } {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { error: 'parse.xlsxEmpty' }

    const sheet = workbook.Sheets[sheetName]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    if (raw.length < 2) return { error: 'parse.xlsxNoRows' }

    const headers = (raw[0] as unknown[]).map((h) => String(h ?? '').trim())
    const dataRows = raw.slice(1, IMPORT_MAX_ROWS + 1)

    const rows: ParsedRow[] = dataRows.map((cells, i) => {
      const rowObj: Record<string, string> = {}
      headers.forEach((h, ci) => {
        rowObj[h] = String((cells as unknown[])[ci] ?? '').trim()
      })
      return { sourceRow: i + 1, raw: rowObj }
    })

    return { headers, rows }
  } catch {
    return { error: 'parse.xlsxParseError' }
  }
}

/** Parse a File into headers + raw rows. Does not validate content. */
export async function parseFile(file: File): Promise<ParseFileResult> {
  if (file.size > IMPORT_MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'parse.fileTooLarge' }
  }

  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    const text = await file.text()
    const result = toCsvRows(text)
    if ('error' in result) return { ok: false, error: result.error }
    return { ok: true, ...result }
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const result = toXlsxRows(buffer)
    if ('error' in result) return { ok: false, error: result.error }
    return { ok: true, ...result }
  }

  return { ok: false, error: 'parse.unsupportedFileType' }
}

// ---------------------------------------------------------------------------
// Mapping phase
// ---------------------------------------------------------------------------

/**
 * Apply a column mapping to parsed rows, producing `mapped` field values.
 * Rows where `mapped` fields are sparse are still kept — validation will
 * later mark them invalid.
 */
export function applyColumnMapping(rows: ParsedRow[], mapping: ColumnMapping): ParsedRow[] {
  return rows.map((row) => {
    const mapped: Partial<Record<ImportableField, string>> = {}
    for (const [header, field] of Object.entries(mapping)) {
      if (field && row.raw[header] !== undefined) {
        mapped[field] = row.raw[header]
      }
    }
    return { ...row, mapped: mapped as Record<ImportableField, string> }
  })
}

// ---------------------------------------------------------------------------
// Validation phase
// ---------------------------------------------------------------------------

export type ExistingSkus = Set<string>

/**
 * Validate a list of mapped rows.
 *
 * - Detects in-file SKU duplicates.
 * - Detects SKUs that already exist in the store (caller supplies the set).
 * - Detects name+category collisions when no SKU is provided (warning only).
 * - Returns ValidatedRow[] with `importable` flag.
 */
export function validateImportRows(
  rows: ParsedRow[],
  existingSkus: ExistingSkus,
): ValidatedRow[] {
  const seenSkus = new Map<string, number>() // normalized sku → first row index
  const seenNameCat = new Map<string, number>() // "name|category" → first row index

  const validated: ValidatedRow[] = rows.map((row, i) => {
    const base: ValidatedRow = {
      ...row,
      valid: false,
      errors: [],
      duplicateInFile: false,
      duplicateInStore: false,
      nameCollision: false,
      importable: false,
    }

    if (!row.mapped) {
      return { ...base, errors: ['validation.notMapped'] }
    }

    const result = validateProduct({
      name: row.mapped.name ?? '',
      category: row.mapped.category ?? '',
      price_per_unit: row.mapped.price_per_unit ?? '',
      description: row.mapped.description ?? null,
      minimum_order: row.mapped.minimum_order ?? null,
      delivery_time: row.mapped.delivery_time ?? null,
      sku: row.mapped.sku ?? null,
      unit: row.mapped.unit ?? null,
      stock_quantity: row.mapped.stock_quantity ?? null,
      reorder_point: row.mapped.reorder_point ?? null,
    })

    if (!result.ok) {
      return { ...base, errors: result.errors }
    }

    const { product } = result
    let duplicateInFile = false
    let duplicateInStore = false
    let nameCollision = false

    // SKU duplicate checks
    if (product.sku) {
      const normalizedSku = product.sku.toLowerCase()
      if (seenSkus.has(normalizedSku)) {
        duplicateInFile = true
      } else {
        seenSkus.set(normalizedSku, i)
      }

      // Store check (case-insensitive)
      const storeSkuNormalized = [...existingSkus].map((s) => s.toLowerCase())
      if (storeSkuNormalized.includes(normalizedSku)) {
        duplicateInStore = true
      }
    } else {
      // Name+category collision check (warning, not blocking by default)
      const key = `${product.name.toLowerCase()}|${product.category}`
      if (seenNameCat.has(key)) {
        nameCollision = true
      } else {
        seenNameCat.set(key, i)
      }
    }

    const importable = !duplicateInFile && !duplicateInStore
    return {
      ...base,
      valid: true,
      product,
      errors: [],
      duplicateInFile,
      duplicateInStore,
      nameCollision,
      importable,
    }
  })

  return validated
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export type ImportSummary = {
  total: number
  importable: number
  invalid: number
  duplicateInFile: number
  duplicateInStore: number
  nameCollisions: number
}

export function computeImportSummary(rows: ValidatedRow[]): ImportSummary {
  let importable = 0
  let invalid = 0
  let duplicateInFile = 0
  let duplicateInStore = 0
  let nameCollisions = 0

  for (const row of rows) {
    if (row.importable) importable++
    else if (!row.valid) invalid++
    else if (row.duplicateInFile) duplicateInFile++
    else if (row.duplicateInStore) duplicateInStore++
    if (row.nameCollision) nameCollisions++
  }

  return {
    total: rows.length,
    importable,
    invalid,
    duplicateInFile,
    duplicateInStore,
    nameCollisions,
  }
}
