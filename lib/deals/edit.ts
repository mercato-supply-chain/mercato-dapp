import type { Deal } from '@/lib/types'
import type { CreateDealFormData, SupplierProductRow } from '@/app/create-deal/types'

type EditableDeal = Pick<
  Deal,
  | 'status'
  | 'fundingStatus'
  | 'investorId'
  | 'fundedAt'
  | 'pymeId'
  | 'productName'
  | 'quantity'
  | 'description'
  | 'category'
  | 'supplier'
  | 'supplierId'
  | 'term'
  | 'fundingWindowDays'
>

/** True when no investor has funded the deal yet (open, extended, or expired window). */
export function isDealUnfunded(
  deal: Pick<Deal, 'status' | 'fundingStatus' | 'investorId' | 'fundedAt'>,
): boolean {
  if (deal.investorId || deal.fundedAt) return false
  if (deal.fundingStatus === 'funded') return false
  return deal.status === 'awaiting_funding'
}

/** Creator (PyME) or admin may edit only while the deal remains unfunded. */
export function canEditDeal(
  deal: Pick<Deal, 'status' | 'fundingStatus' | 'investorId' | 'fundedAt' | 'pymeId'>,
  opts: { userId: string | null; isPyme: boolean; isAdmin: boolean },
): boolean {
  if (!opts.userId) return false
  if (!isDealUnfunded(deal)) return false
  return opts.isAdmin || opts.isPyme
}

/** Match catalog product by supplier + name for prefilling the edit form. */
export function findCatalogProductForDeal(
  deal: Pick<Deal, 'supplierId' | 'productName'>,
  products: SupplierProductRow[],
): SupplierProductRow | undefined {
  if (!deal.supplierId || !deal.productName) return undefined
  return products.find(
    (p) => p.supplier_id === deal.supplierId && p.name === deal.productName,
  )
}

export function dealToFormData(
  deal: EditableDeal,
  products: SupplierProductRow[],
): CreateDealFormData {
  const matched = findCatalogProductForDeal(deal, products)
  const supplierProduct = products.find((p) => p.supplier_id === deal.supplierId)
  const supplierContact =
    supplierProduct?.supplier?.email ??
    supplierProduct?.supplier?.address ??
    ''

  return {
    category: deal.category ?? matched?.category ?? '',
    supplierId: deal.supplierId ?? '',
    supplierName: deal.supplier || supplierProduct?.supplier?.company_name || '',
    supplierContact,
    productId: matched?.id ?? '',
    description: deal.description ?? '',
    quantity: deal.quantity > 0 ? String(deal.quantity) : '',
    term: deal.term > 0 ? String(deal.term) : '60',
    fundingWindowDays:
      deal.fundingWindowDays && deal.fundingWindowDays > 0
        ? String(deal.fundingWindowDays)
        : '7',
  }
}
