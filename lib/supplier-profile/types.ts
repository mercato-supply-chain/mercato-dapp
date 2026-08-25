export type SupplierCompany = {
  id: string
  company_name: string | null
  bio: string | null
  country: string | null
  sector: string | null
  phone: string | null
  logo_url: string | null
  website: string | null
  address: string | null
  categories: string[] | null
}

export type SupplierProduct = {
  id: string
  supplier_id: string
  name: string
  category: string
  price_per_unit: number
  description: string | null
  minimum_order: number | null
  delivery_time: string | null
  image_url: string | null
  sku: string | null
  unit: string
  stock_quantity: number
  reserved_quantity: number
  reorder_point: number
  status: 'active' | 'paused' | 'discontinued'
}

export const PRODUCT_SELECT =
  'id, supplier_id, name, category, price_per_unit, description, minimum_order, delivery_time, image_url, sku, unit, stock_quantity, reserved_quantity, reorder_point, status' as const

export type ProductFormState = {
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
  status: string
  imageFile: File | null
  imagePreview: string | null
}

export const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: '',
  category: '',
  price_per_unit: '',
  description: '',
  minimum_order: '',
  delivery_time: '',
  sku: '',
  unit: 'unit',
  stock_quantity: '0',
  reorder_point: '0',
  status: 'active',
  imageFile: null,
  imagePreview: null,
}

export type CompanyFormState = {
  bio: string
  country: string
  sector: string
  phone: string
  website: string
  address: string
  logo_url: string
  categories: string[]
}

export const PAGE_SIZE = 20
