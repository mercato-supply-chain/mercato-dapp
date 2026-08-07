'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupplierProductRow } from '@/app/create-deal/types'

export function useCreateDealInit(options?: { redirectIfUnauthenticated?: boolean }) {
  const redirectIfUnauthenticated = options?.redirectIfUnauthenticated !== false
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [supplierProducts, setSupplierProducts] = useState<SupplierProductRow[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (redirectIfUnauthenticated) {
          router.push('/auth/login')
        }
        setIsReady(true)
        return
      }
      setUserId(user.id)
      let products: SupplierProductRow[] = []
      try {
        const res = await fetch('/api/catalog?page=1&pageSize=50')
        if (res.ok) {
          const json: any = await res.json()
          if (json && Array.isArray(json.data)) {
            products = json.data as SupplierProductRow[]
          } else if (Array.isArray(json)) {
            products = json as SupplierProductRow[]
          }
        }
      } catch {
        // fallback: load via client (requires RLS policy supplier_products_select_all)
      }
      if (products.length === 0) {
        const productsResult = await supabase
          .from('supplier_products')
          .select(
            'id, supplier_id, name, category, price_per_unit, description, image_url, sku, unit, stock_quantity, reserved_quantity, reorder_point, supplier:supplier_companies(id, company_name, logo_url)'
          )
          .order('category')
          .order('name')
          .range(0, 49)
        products = ((productsResult.data as SupplierProductRow[]) || [])
      }
      setSupplierProducts(products)
      setIsReady(true)
    }
    init()
  }, [redirectIfUnauthenticated, router, supabase])

  return { userId, supplierProducts, isReady }
}
