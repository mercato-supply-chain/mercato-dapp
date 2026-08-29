/**
 * POST /api/supplier/import-products
 *
 * Authenticated bulk-import endpoint for supplier inventory.
 *
 * Security:
 *  - Uses the server (anon-key) Supabase client — honours RLS.
 *  - Does NOT use the service-role client.
 *  - Verifies the authenticated user owns the target supplier_company.
 *
 * Request body (JSON):
 * {
 *   companyId: string,
 *   rows: Array<{
 *     name: string;
 *     category: string;
 *     price_per_unit: number;
 *     description?: string | null;
 *     minimum_order?: number | null;
 *     delivery_time?: string | null;
 *     sku?: string | null;
 *     unit?: string;
 *     stock_quantity?: number;
 *     reorder_point?: number;
 *   }>
 * }
 *
 * Response body (JSON):
 * {
 *   imported: number,
 *   skipped: number,
 *   products: SupplierProduct[],
 *   rowResults: Array<{ sourceRow?: number; ok: boolean; error?: string }>
 * }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateProduct } from '@/lib/supplier-profile/product-validation'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50
const MAX_ROWS_PER_REQUEST = 1_000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IncomingRow = {
  sourceRow?: number
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

type RowResult = {
  sourceRow?: number
  ok: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Safe error message (no internal DB details exposed)
// ---------------------------------------------------------------------------

function safeDbError(code: string | undefined): string {
  // Unique constraint violation (concurrent SKU collision)
  if (code === '23505') return 'import.errorSkuConflict'
  // Check constraint
  if (code === '23514') return 'import.errorConstraint'
  return 'import.errorRowInsert'
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient()

  // --- Authentication ---
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'import.errorUnauthorized' }, { status: 401 })
  }

  // --- Parse body ---
  let body: { companyId?: unknown; rows?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'import.errorInvalidBody' }, { status: 400 })
  }

  const { companyId, rows: rawRows } = body

  if (typeof companyId !== 'string' || !companyId.trim()) {
    return NextResponse.json({ error: 'import.errorMissingCompanyId' }, { status: 400 })
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json({ error: 'import.errorNoRows' }, { status: 400 })
  }

  if (rawRows.length > MAX_ROWS_PER_REQUEST) {
    return NextResponse.json({ error: 'import.errorTooManyRows' }, { status: 400 })
  }

  // --- Verify company ownership ---
  const { data: company, error: companyError } = await supabase
    .from('supplier_companies')
    .select('id, owner_id')
    .eq('id', companyId)
    .eq('owner_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'import.errorCompanyNotFound' }, { status: 403 })
  }

  // --- Re-validate all rows server-side ---
  const incomingRows: IncomingRow[] = rawRows as IncomingRow[]

  const validatedRows: Array<{
    sourceRow?: number
    ok: boolean
    sku: string | null
    payload: Record<string, unknown> | null
    error?: string
  }> = incomingRows.map((r, i) => {
    const result = validateProduct({
      name: r.name,
      category: r.category,
      price_per_unit: r.price_per_unit,
      description: r.description,
      minimum_order: r.minimum_order,
      delivery_time: r.delivery_time,
      sku: r.sku,
      unit: r.unit,
      stock_quantity: r.stock_quantity,
      reorder_point: r.reorder_point,
    })

    if (!result.ok) {
      return {
        sourceRow: r.sourceRow ?? i + 1,
        ok: false,
        sku: null,
        payload: null,
        error: result.errors[0] ?? 'validation.failed',
      }
    }

    return {
      sourceRow: r.sourceRow ?? i + 1,
      ok: true,
      sku: result.product.sku,
      payload: {
        supplier_id: companyId,
        name: result.product.name,
        category: result.product.category,
        price_per_unit: result.product.price_per_unit,
        description: result.product.description,
        minimum_order: result.product.minimum_order,
        delivery_time: result.product.delivery_time,
        sku: result.product.sku,
        unit: result.product.unit,
        stock_quantity: result.product.stock_quantity,
        reorder_point: result.product.reorder_point,
        reserved_quantity: 0,
        // image_url is intentionally omitted — import sets it null
      },
    }
  })

  // --- Query existing SKUs for this supplier ---
  const skusToCheck = validatedRows
    .filter((r) => r.ok && r.sku)
    .map((r) => r.sku as string)

  let storedSkusLower = new Set<string>()

  if (skusToCheck.length > 0) {
    const { data: existingSkuRows } = await supabase
      .from('supplier_products')
      .select('sku')
      .eq('supplier_id', companyId)
      .not('sku', 'is', null)

    if (existingSkuRows) {
      storedSkusLower = new Set(
        existingSkuRows
          .map((r) => (r.sku as string).toLowerCase())
          .filter(Boolean),
      )
    }
  }

  // --- Filter out rows with duplicate stored SKUs ---
  const rowResults: RowResult[] = []
  const pendingSkus = new Set<string>()
  const rowsToInsert: Array<{
    sourceRow?: number
    payload: Record<string, unknown>
  }> = []

  for (const r of validatedRows) {
    if (!r.ok) {
      rowResults.push({ sourceRow: r.sourceRow, ok: false, error: r.error })
      continue
    }
    if (r.sku && storedSkusLower.has(r.sku.toLowerCase())) {
      rowResults.push({
        sourceRow: r.sourceRow,
        ok: false,
        error: 'import.errorSkuAlreadyExists',
      })
      continue
    }
    if (r.sku) {
      const normalizedSku = r.sku.toLowerCase()
      if (pendingSkus.has(normalizedSku)) {
        rowResults.push({
          sourceRow: r.sourceRow,
          ok: false,
          error: 'import.errorSkuAlreadyExists',
        })
        continue
      }
      pendingSkus.add(normalizedSku)
    }
    // Mark as pending — will update after insert
    rowsToInsert.push({ sourceRow: r.sourceRow, payload: r.payload! })
  }

  // --- Insert in bounded batches ---
  const importedProducts: Record<string, unknown>[] = []

  for (let offset = 0; offset < rowsToInsert.length; offset += BATCH_SIZE) {
    const batch = rowsToInsert.slice(offset, offset + BATCH_SIZE)
    const payloads = batch.map((r) => r.payload)

    const { data: inserted, error: insertError } = await supabase
      .from('supplier_products')
      .insert(payloads)
      .select(
        'id, supplier_id, name, category, price_per_unit, description, minimum_order, delivery_time, image_url, sku, unit, stock_quantity, reserved_quantity, reorder_point',
      )

    if (insertError) {
      // Map each row in batch to a safe error
      for (const r of batch) {
        rowResults.push({
          sourceRow: r.sourceRow,
          ok: false,
          error: safeDbError(insertError.code),
        })
      }
      continue
    }

    for (const r of batch) {
      rowResults.push({ sourceRow: r.sourceRow, ok: true })
    }

    if (inserted) {
      importedProducts.push(...(inserted as Record<string, unknown>[]))
    }
  }

  const imported = importedProducts.length
  const skipped = rowResults.filter((r) => !r.ok).length

  return NextResponse.json({
    imported,
    skipped,
    products: importedProducts,
    rowResults,
  })
}
