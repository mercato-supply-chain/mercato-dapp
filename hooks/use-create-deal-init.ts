'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupplierProductRow } from '@/app/create-deal/types'

export function useCreateDealInit() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [supplierProducts, setSupplierProducts] = useState<SupplierProductRow[]>([])

  useEffect(() => {
    const init = async () => {
      const authResult = supabase.auth.getUser()
      let products: SupplierProductRow[] = []
      try {
        const res = await fetch('/api/catalog')
        if (res.ok) {
          const data: unknown = await res.json()
          if (Array.isArray(data)) {
            products = data as SupplierProductRow[]
          }
        }
      } catch {
        // fallback: load via client (requires RLS policy supplier_products_select_all)
      }
      if (products.length === 0) {
        const productsResult = await supabase
          .from('supplier_products')
          .select(
            'id, supplier_id, name, category, price_per_unit, description, image_url, sku, unit, stock_quantity, reserved_quantity, reorder_point, supplier:supplier_companies(id, company_name, address, owner_id, logo_url)'
          )
          .order('category')
        const raw = (productsResult.data as any) || []
        const ownerIds = [...new Set(raw.map((p: any) => p.supplier?.owner_id).filter(Boolean))] as string[]
        const { data: ownerProfiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', ownerIds.length ? ownerIds : ['00000000-0000-0000-0000-000000000000'])
        const emailByOwner: Record<string, string> = {}
        for (const p of ownerProfiles ?? []) {
          emailByOwner[p.id] = p.email ?? ''
        }
        products = raw.map((p: any) => ({
          ...p,
          supplier: p.supplier
            ? { ...p.supplier, email: emailByOwner[p.supplier.owner_id ?? ''] }
            : p.supplier,
        })) as unknown as SupplierProductRow[]
      }
      setSupplierProducts(products)
      const { data: { user } } = await authResult
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserId(user.id)
    }
    init()
  }, [router, supabase])

  return { userId, supplierProducts }
}
