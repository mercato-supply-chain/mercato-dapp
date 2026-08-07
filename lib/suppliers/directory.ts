import { createServiceClient } from '@/lib/supabase/service'
import type { Supplier } from '@/lib/suppliers/directory-utils'

const COMPANY_COLUMNS =
  'id, company_name, bio, verified, country, sector, logo_url'

const DETAIL_COLUMNS =
  'id, owner_id, company_name, bio, full_name, contact_name, categories, products, verified, country, sector, logo_url'

export type PublicSupplierCompany = {
  id: string
  company_name: string
  bio: string | null
  verified: boolean
  country: string | null
  sector: string | null
  logo_url: string | null
}

export type PublicSupplierDetail = PublicSupplierCompany & {
  owner_id: string
  full_name: string | null
  contact_name: string | null
  categories: string[] | null
  products: string[] | null
}

type ProductIndexRow = {
  supplier_id: string
  name: string
  category: string
}

function buildProductIndex(rows: ProductIndexRow[]) {
  const productsBySupplier: Record<string, { categories: string[]; products: string[] }> = {}
  for (const row of rows) {
    const sid = row.supplier_id
    if (!productsBySupplier[sid]) productsBySupplier[sid] = { categories: [], products: [] }
    if (row.category && !productsBySupplier[sid].categories.includes(row.category)) {
      productsBySupplier[sid].categories.push(row.category)
    }
    if (row.name) productsBySupplier[sid].products.push(row.name)
  }
  return productsBySupplier
}

async function fetchSupplierProductRows(
  supabase: ReturnType<typeof createServiceClient>,
  companyIds: string[],
): Promise<ProductIndexRow[]> {
  if (companyIds.length === 0) return []

  const { data, error } = await supabase
    .from('supplier_products')
    .select('supplier_id, name, category')
    .in('supplier_id', companyIds)

  if (error) throw error
  return (data ?? []) as ProductIndexRow[]
}

/** All public supplier companies (table rows + any ids referenced on deals). */
export async function fetchPublicSupplierCompanies(): Promise<PublicSupplierCompany[]> {
  const supabase = createServiceClient()

  const [companiesRes, dealsRes] = await Promise.all([
    supabase.from('supplier_companies').select(COMPANY_COLUMNS).order('company_name'),
    supabase.from('deals').select('supplier_id').not('supplier_id', 'is', null),
  ])

  if (companiesRes.error) throw companiesRes.error
  if (dealsRes.error) throw dealsRes.error

  const byId = new Map<string, PublicSupplierCompany>()
  for (const row of companiesRes.data ?? []) {
    byId.set(row.id, {
      id: row.id,
      company_name: row.company_name ?? '',
      bio: row.bio ?? null,
      verified: row.verified ?? false,
      country: row.country ?? null,
      sector: row.sector ?? null,
      logo_url: row.logo_url ?? null,
    })
  }

  const missingFromDeals = [
    ...new Set(
      (dealsRes.data ?? [])
        .map((d) => d.supplier_id)
        .filter((id): id is string => Boolean(id) && !byId.has(id)),
    ),
  ]

  if (missingFromDeals.length > 0) {
    const { data: extra, error } = await supabase
      .from('supplier_companies')
      .select(COMPANY_COLUMNS)
      .in('id', missingFromDeals)
    if (error) throw error
    for (const row of extra ?? []) {
      byId.set(row.id, {
        id: row.id,
        company_name: row.company_name ?? '',
        bio: row.bio ?? null,
        verified: row.verified ?? false,
        country: row.country ?? null,
        sector: row.sector ?? null,
        logo_url: row.logo_url ?? null,
      })
    }
  }

  return [...byId.values()]
}

/** Supplier directory rows with catalog categories and product names. */
export async function fetchPublicSuppliers(): Promise<Supplier[]> {
  const supabase = createServiceClient()
  const companies = await fetchPublicSupplierCompanies()
  const productsBySupplier = buildProductIndex(
    await fetchSupplierProductRows(
      supabase,
      companies.map((c) => c.id),
    ),
  )

  return companies
    .map((company) => {
      const fromProducts = productsBySupplier[company.id]
      return {
        ...company,
        categories: fromProducts?.categories.length ? fromProducts.categories : null,
        products: fromProducts?.products.length ? fromProducts.products : null,
      }
    })
    .toSorted((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      return a.company_name.localeCompare(b.company_name)
    })
}

/** Single supplier for the public profile page. */
export async function fetchPublicSupplier(id: string): Promise<PublicSupplierDetail | null> {
  const supabase = createServiceClient()
  const { data: company, error } = await supabase
    .from('supplier_companies')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (company) return company as PublicSupplierDetail

  const { count, error: dealsError } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', id)

  if (dealsError) throw dealsError
  return null
}
