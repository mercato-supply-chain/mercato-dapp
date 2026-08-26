import { describe, expect, test } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authorizeSupplierActivityAccess } from '@/lib/suppliers/supplier-activity-authorization'

function mockSupabase(user: { id: string } | null, userType: string | null) {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          single: async () => ({ data: userType ? { user_type: userType } : null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('authorizeSupplierActivityAccess', () => {
  test('returns unauthenticated when there is no session user', async () => {
    const result = await authorizeSupplierActivityAccess(mockSupabase(null, null))
    expect(result).toEqual({ status: 'unauthenticated' })
  })

  test('returns unauthorized when the profile is not a supplier', async () => {
    const result = await authorizeSupplierActivityAccess(mockSupabase({ id: 'user-1' }, 'pyme'))
    expect(result).toEqual({ status: 'unauthorized' })
  })

  test('returns unauthorized when the profile is missing', async () => {
    const result = await authorizeSupplierActivityAccess(mockSupabase({ id: 'user-1' }, null))
    expect(result).toEqual({ status: 'unauthorized' })
  })

  test('returns authorized with the user id for a supplier profile', async () => {
    const result = await authorizeSupplierActivityAccess(
      mockSupabase({ id: 'user-1' }, 'supplier'),
    )
    expect(result).toEqual({ status: 'authorized', userId: 'user-1' })
  })
})
