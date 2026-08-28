import { describe, expect, test } from 'bun:test'
import { assertSupplierOwnsCompany } from '@/lib/referrals/owner-scope'

describe('supplier referral owner scoping', () => {
  test('assertSupplierOwnsCompany returns false without a matching row', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        }),
      }),
    }

    const owns = await assertSupplierOwnsCompany(supabase as never, 'owner-1', 'company-1')
    expect(owns).toBe(false)
  })

  test('assertSupplierOwnsCompany returns true when company belongs to owner', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'company-1' } }),
            }),
          }),
        }),
      }),
    }

    const owns = await assertSupplierOwnsCompany(supabase as never, 'owner-1', 'company-1')
    expect(owns).toBe(true)
  })
})
