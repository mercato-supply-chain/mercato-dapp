export type SupplierCompany = {
  id: string
  company_name: string | null
  bio: string | null
  country: string | null
  sector: string | null
  phone: string | null
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
}

export type ProductFormState = {
  name: string
  category: string
  price_per_unit: string
  description: string
  minimum_order: string
  delivery_time: string
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
  imageFile: null,
  imagePreview: null,
}

export type CompanyFormState = {
  bio: string
  country: string
  sector: string
  phone: string
}

export const PAGE_SIZE = 20
