export type FormStep = 1 | 2

export interface CreateDealProfile {
  id: string
  address?: string | null
  [key: string]: unknown
}

/** Product from supplier catalog (supplier_products table) */
export interface SupplierProductRow {
  id: string
  supplier_id: string
  name: string
  category: string
  price_per_unit: number
  description?: string | null
  image_url?: string | null
  sku?: string | null
  unit?: string
  stock_quantity?: number
  reserved_quantity?: number
  reorder_point?: number
  supplier?: {
    id: string
    company_name?: string
    email?: string
    address?: string
    logo_url?: string | null
  } | null
}

export interface CreateDealSupplier {
  id: string
  company_name: string
  address?: string | null
  email?: string | null
  categories?: string[] | null
  products?: string[] | null
}

export interface CreateDealFormData {
  category: string
  supplierId: string
  supplierName: string
  supplierContact: string
  productId: string
  description: string
  quantity: string
  term: string
  fundingWindowDays: string
}

export const DEFAULT_FORM_DATA: CreateDealFormData = {
  category: '',
  supplierId: '',
  supplierName: '',
  supplierContact: '',
  productId: '',
  description: '',
  quantity: '',
  term: '60',
  fundingWindowDays: '7',
}

export function formatCategoryLabel(cat: string): string {
  return cat
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
