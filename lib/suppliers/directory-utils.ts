export type Supplier = {
  id: string
  company_name: string
  bio: string | null
  address: string | null
  phone: string | null
  email: string
  categories: string[] | null
  products: string[] | null
  verified: boolean
  country: string | null
  sector: string | null
  logo_url: string | null
}

export type SupplierDirectoryFilters = {
  searchQuery: string
  selectedCategory: string
  selectedCountry: string
  selectedSector: string
}

export type SupplierDirectoryStats = {
  total: number
  verified: number
  countries: number
}

export function filterSuppliers(
  suppliers: Supplier[],
  filters: SupplierDirectoryFilters
): Supplier[] {
  const q = filters.searchQuery.toLowerCase()
  return suppliers.filter((s) => {
    if (
      q &&
      !s.company_name?.toLowerCase().includes(q) &&
      !s.bio?.toLowerCase().includes(q) &&
      !s.products?.some((p) => p.toLowerCase().includes(q))
    )
      return false
    if (filters.selectedCategory !== 'all' && !s.categories?.includes(filters.selectedCategory))
      return false
    if (filters.selectedCountry !== 'all' && s.country !== filters.selectedCountry) return false
    if (filters.selectedSector !== 'all' && s.sector !== filters.selectedSector) return false
    return true
  })
}

export function computeSupplierStats(suppliers: Supplier[]): SupplierDirectoryStats {
  return {
    total: suppliers.length,
    verified: suppliers.filter((s) => s.verified).length,
    countries: new Set(suppliers.map((s) => s.country).filter(Boolean)).size,
  }
}

export function hasActiveSupplierFilters(filters: SupplierDirectoryFilters): boolean {
  return (
    filters.selectedCategory !== 'all' ||
    filters.selectedCountry !== 'all' ||
    filters.selectedSector !== 'all' ||
    filters.searchQuery !== ''
  )
}
