import { describe, expect, test, mock } from 'bun:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDictionary } from '@/lib/i18n/dictionaries'

const enMessages = getDictionary('en')

function tr(messages: typeof enMessages, key: string): string {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (node == null || typeof node !== 'object') return undefined
    return (node as Record<string, unknown>)[part]
  }, messages as unknown)
  return typeof value === 'string' ? value : key
}

mock.module('@/lib/i18n/server', () => ({
  getServerDictionary: async () => enMessages,
  tr: (messages: typeof enMessages, key: string) => tr(messages, key),
}))

import { getAdminQueueData } from '@/lib/admin/get-admin-queue-data'

type MockDealRow = {
  id: string
  title?: string
  product_name?: string | null
  amount: number
  interest_rate?: number | null
  term_days?: number | null
  escrow_contract_address: string | null
  repayment_status?: string | null
  repayment_total_amount?: number | null
  repayment_milestones?: Array<{
    index: number
    description: string
    amount: number
    released: boolean
  }> | null
  created_at?: string | null
  pyme_id?: string
  supplier_id?: string
  pyme?: { company_name?: string } | null
  supplier?: { company_name?: string } | null
}

function mockSupabaseForQueue(createRows: MockDealRow[], releaseRows: MockDealRow[]) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: async (_col: string, _val: string) => ({ data: createRows, error: null }),
        in: (_col: string, _vals: string[]) => ({
          not: async (_col2: string, _op: string, _val2: null) => ({
            data: releaseRows,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('getAdminQueueData repayment queues', () => {
  test('order_confirmed deals appear in create escrow queue', async () => {
    const createRow: MockDealRow = {
      id: 'deal-oc',
      title: 'Order confirmed deal',
      amount: 10000,
      interest_rate: 10,
      term_days: 60,
      escrow_contract_address: null,
      repayment_status: 'order_confirmed',
      created_at: '2026-01-15T00:00:00.000Z',
      pyme_id: 'pyme-1',
      supplier_id: 'sup-1',
      pyme: { company_name: 'PyME Co' },
      supplier: { company_name: 'Supplier Co' },
    }

    const data = await getAdminQueueData(mockSupabaseForQueue([createRow], []))
    expect(data.createEscrowItems.length).toBe(1)
    expect(data.createEscrowItems[0].dealId).toBe('deal-oc')
    expect(data.createEscrowItems[0].defaultFirstMilestoneAmount).toBeGreaterThan(0)
    expect(data.items.length).toBe(0)
  })

  test('partially_released with remaining shows append placeholder in release queue', async () => {
    const releaseRow: MockDealRow = {
      id: 'deal-pr',
      title: 'Partial release',
      amount: 10000,
      interest_rate: 10,
      term_days: 60,
      escrow_contract_address: 'CESCA123',
      repayment_status: 'partially_released',
      repayment_total_amount: 11000,
      repayment_milestones: [
        { index: 0, description: 'First half', amount: 5500, released: true },
      ],
      created_at: '2026-01-10T00:00:00.000Z',
      pyme_id: 'pyme-1',
      supplier_id: 'sup-1',
    }

    const data = await getAdminQueueData(mockSupabaseForQueue([], [releaseRow]))
    expect(data.createEscrowItems.length).toBe(0)
    expect(data.items.length).toBe(1)
    expect(data.items[0].dealId).toBe('deal-pr')
    expect(data.items[0].milestoneTitle).toContain('Add next')
    expect(data.items[0].remainingToSchedule).toBeGreaterThan(0)
  })

  test('legacy ready_to_release with empty cache shows fallback open milestone', async () => {
    const releaseRow: MockDealRow = {
      id: 'deal-legacy',
      title: 'Legacy ready',
      amount: 5000,
      interest_rate: 8,
      term_days: 45,
      escrow_contract_address: 'CESCA456',
      repayment_status: 'ready_to_release',
      repayment_milestones: [],
      repayment_total_amount: 5200,
      created_at: '2026-01-05T00:00:00.000Z',
      pyme_id: 'pyme-2',
      supplier_id: 'sup-2',
    }

    const data = await getAdminQueueData(mockSupabaseForQueue([], [releaseRow]))
    expect(data.items.length).toBe(1)
    expect(data.items[0].milestoneIndex).toBe(0)
    expect(data.items[0].milestoneAmount).toBe(5200)
    expect(data.releaseFallbackItems.length).toBe(1)
  })
})
