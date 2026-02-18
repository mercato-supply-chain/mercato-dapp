import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export type CatalogProduct = {
  id: string
  supplier_id: string
  name: string
  category: string
  price_per_unit: number
  description?: string | null
  supplier?: {
    id: string
    company_name?: string
    address?: string
    owner_id?: string
    email?: string
  } | null
}

/**
 * GET /api/catalog – returns all supplier products with company info.
 * Uses service role so the catalog is visible regardless of RLS (for Create Deal).
 */
export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data: products, error } = await supabase
      .from('supplier_products')
      .select(
        'id, supplier_id, name, category, price_per_unit, description, supplier:supplier_companies(id, company_name, address, owner_id)'
      )
      .order('category')

    if (error) {
      console.error('[catalog]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (products ?? []) as Array<{
      id: string
      supplier_id: string
      name: string
      category: string
      price_per_unit: number
      description?: string | null
      supplier?: { id: string; company_name?: string; address?: string; owner_id?: string } | null
    }>

    const ownerIds = [...new Set(rows.map((p) => p.supplier?.owner_id).filter(Boolean))] as string[]
    const emailByOwner: Record<string, string> = {}
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', ownerIds)
      for (const p of profiles ?? []) {
        emailByOwner[p.id] = p.email ?? ''
      }
    }

    const withEmail: CatalogProduct[] = rows.map((p) => ({
      ...p,
      supplier: p.supplier
        ? { ...p.supplier, email: emailByOwner[p.supplier.owner_id ?? ''] }
        : p.supplier,
    }))

    return NextResponse.json(withEmail)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load catalog'
    console.error('[catalog]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
