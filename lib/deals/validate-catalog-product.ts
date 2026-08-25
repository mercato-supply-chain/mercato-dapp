import { getAvailableQuantity } from '@/lib/supplier-profile/inventory'

export type CatalogProductForDeal = {
  id: string
  supplier_id: string
  name: string
  category: string
  price_per_unit: number
  description?: string | null
  stock_quantity?: number | null
  reserved_quantity?: number | null
}

export type ValidateCatalogProductResult =
  | { ok: true; unitPrice: number }
  | { ok: false; error: string }

/**
 * Authoritative server-side validation for catalog-backed deals.
 * Price is always taken from the catalog row, not the client.
 */
export function validateCatalogProductForDeal(
  product: CatalogProductForDeal | null | undefined,
  supplierId: string,
  quantity: number,
): ValidateCatalogProductResult {
  if (!product) {
    return { ok: false, error: 'Product not found' }
  }

  if (product.supplier_id !== supplierId) {
    return { ok: false, error: 'Product does not belong to the selected supplier company' }
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: 'Product quantity must be a positive integer' }
  }

  const available = getAvailableQuantity({
    stock_quantity: product.stock_quantity ?? 0,
    reserved_quantity: product.reserved_quantity ?? 0,
  })

  if (available < quantity) {
    return { ok: false, error: 'Insufficient product inventory for the requested quantity' }
  }

  const unitPrice = Number(product.price_per_unit)
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return { ok: false, error: 'Product unit price is invalid' }
  }

  return { ok: true, unitPrice }
}
