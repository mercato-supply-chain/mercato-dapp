/**
 * Shared product validation and normalization.
 *
 * Browser-safe: no server-only imports, no React.
 * Used by both the manual product form and the bulk import workflow.
 */

import { PRODUCT_CATEGORIES } from '@/lib/categories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RawProductFields = {
  name: string
  category: string
  price_per_unit: string | number
  description?: string | null
  minimum_order?: string | number | null
  delivery_time?: string | null
  sku?: string | null
  unit?: string | null
  stock_quantity?: string | number | null
  reorder_point?: string | number | null
}

export type NormalizedProduct = {
  name: string
  category: string
  price_per_unit: number
  description: string | null
  minimum_order: number | null
  delivery_time: string | null
  sku: string | null
  unit: string
  stock_quantity: number
  reorder_point: number
}

export type ValidationResult =
  | { ok: true; product: NormalizedProduct }
  | { ok: false; errors: string[] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a category string against PRODUCT_CATEGORIES; falls back to 'other'. */
export function normalizeCategory(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  const match = PRODUCT_CATEGORIES.find(
    (c) =>
      c.value === trimmed ||
      c.label.toLowerCase() === trimmed,
  )
  return match ? match.value : 'other'
}

/** Normalize a nonempty SKU or return null. */
export function normalizeSku(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Parse and floor a non-negative integer field (stock, reorder). Returns 0 on bad input. */
function parseNonNegInt(val: string | number | null | undefined): number {
  if (val == null || val === '') return 0
  const n = typeof val === 'number' ? val : Number.parseInt(String(val), 10)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

/** Parse a positive float price. Returns NaN if invalid. */
function parsePrice(val: string | number): number {
  const n = typeof val === 'number' ? val : Number.parseFloat(String(val))
  return n
}

/** Parse optional minimum order – null if empty/invalid/negative. */
function parseMinOrder(val: string | number | null | undefined): number | null {
  if (val == null || val === '') return null
  const n = typeof val === 'number' ? val : Number.parseFloat(String(val))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

// ---------------------------------------------------------------------------
// Core validator
// ---------------------------------------------------------------------------

/**
 * Validate and normalize raw product fields.
 *
 * Returns `{ ok: true, product }` on success or
 * `{ ok: false, errors: string[] }` listing all field problems.
 *
 * Error strings are plain English keys (callers translate them via i18n).
 */
export function validateProduct(raw: RawProductFields): ValidationResult {
  const errors: string[] = []

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) errors.push('validation.nameRequired')

  const category = typeof raw.category === 'string' ? raw.category.trim() : ''
  if (!category) errors.push('validation.categoryRequired')

  const price_per_unit = parsePrice(raw.price_per_unit ?? '')
  if (Number.isNaN(price_per_unit) || price_per_unit <= 0) {
    errors.push('validation.priceInvalid')
  }

  if (errors.length > 0) return { ok: false, errors }

  const normalizedCategory = normalizeCategory(category)

  const minimum_order = parseMinOrder(raw.minimum_order)
  const delivery_time =
    typeof raw.delivery_time === 'string' && raw.delivery_time.trim()
      ? raw.delivery_time.trim()
      : null
  const sku = normalizeSku(raw.sku as string | null | undefined)
  const unit =
    typeof raw.unit === 'string' && raw.unit.trim()
      ? raw.unit.trim()
      : 'unit'
  const stock_quantity = parseNonNegInt(raw.stock_quantity)
  const reorder_point = parseNonNegInt(raw.reorder_point)
  const description =
    typeof raw.description === 'string' && raw.description.trim()
      ? raw.description.trim()
      : null

  return {
    ok: true,
    product: {
      name,
      category: normalizedCategory,
      price_per_unit,
      description,
      minimum_order,
      delivery_time,
      sku,
      unit,
      stock_quantity,
      reorder_point,
    },
  }
}

/**
 * Convenience: parse the existing ProductFormState shape (string fields)
 * as used in use-supplier-products.ts.
 */
export function parseProductFormFields(fields: {
  name: string
  category: string
  price_per_unit: string
  description: string
  minimum_order: string
  delivery_time: string
  sku: string
  unit: string
  stock_quantity: string
  reorder_point: string
}): ValidationResult {
  return validateProduct({
    name: fields.name,
    category: fields.category,
    price_per_unit: fields.price_per_unit,
    description: fields.description,
    minimum_order: fields.minimum_order,
    delivery_time: fields.delivery_time,
    sku: fields.sku,
    unit: fields.unit,
    stock_quantity: fields.stock_quantity,
    reorder_point: fields.reorder_point,
  })
}
