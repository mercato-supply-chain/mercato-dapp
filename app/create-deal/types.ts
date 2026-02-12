export type FormStep = 1 | 2 | 3

export interface CreateDealProfile {
  id: string
  address?: string | null
  [key: string]: unknown
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
  productName: string
  description: string
  category: string
  quantity: string
  pricePerUnit: string
  supplierId: string
  supplierName: string
  supplierContact: string
  term: string
  milestone1Name: string
  milestone1Percentage: string
  milestone2Name: string
  milestone2Percentage: string
}

export const DEFAULT_FORM_DATA: CreateDealFormData = {
  productName: '',
  description: '',
  category: '',
  quantity: '',
  pricePerUnit: '',
  supplierId: '',
  supplierName: '',
  supplierContact: '',
  term: '60',
  milestone1Name: 'Shipment Confirmation',
  milestone1Percentage: '50',
  milestone2Name: 'Delivery Confirmation',
  milestone2Percentage: '50',
}

export function formatCategoryLabel(cat: string): string {
  return cat
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
