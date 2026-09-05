import { describe, expect, test } from 'bun:test'
import { isDealFundingExpired } from '@/lib/deals'
import { buildDealReopenUpdate } from '@/lib/deals/reopen'

const baseRow = {
  status: 'seeking_funding',
  investor_id: null,
  funded_at: null,
  funding_expires_at: '2020-01-01T00:00:00.000Z',
  extension_count: 0,
}

describe('isDealFundingExpired', () => {
  test('returns true for unfunded seeking_funding deal past expiration', () => {
    expect(isDealFundingExpired(baseRow, Date.parse('2026-01-01T00:00:00.000Z'))).toBe(true)
  })

  test('returns false when funding window is still open', () => {
    expect(
      isDealFundingExpired(
        {
          ...baseRow,
          funding_expires_at: '2099-01-01T00:00:00.000Z',
        },
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(false)
  })

  test('returns false when deal is extended but not expired', () => {
    expect(
      isDealFundingExpired(
        {
          ...baseRow,
          extension_count: 2,
          funding_expires_at: '2099-01-01T00:00:00.000Z',
        },
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(false)
  })

  test('returns false when deal is funded', () => {
    expect(
      isDealFundingExpired(
        {
          ...baseRow,
          investor_id: 'investor-1',
        },
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(false)
  })

  test('returns false when status is not seeking_funding', () => {
    expect(
      isDealFundingExpired(
        {
          ...baseRow,
          status: 'funded',
        },
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(false)
  })
})

describe('buildDealReopenUpdate', () => {
  test('builds reopen payload with history and resets extensions', () => {
    const nowMs = Date.parse('2026-06-01T12:00:00.000Z')
    const result = buildDealReopenUpdate(
      {
        ...baseRow,
        reopen_count: 1,
        reopen_history: [
          {
            sequence: 1,
            previous_expiration_at: '2019-01-01T00:00:00.000Z',
            new_expiration_at: '2020-01-01T00:00:00.000Z',
            reopened_at: '2020-01-01T00:00:00.000Z',
            reopened_by: 'admin-1',
            funding_window_days: 7,
          },
        ],
      },
      14,
      'admin-2',
      nowMs,
    )

    expect(result.reopen_count).toBe(2)
    expect(result.funding_window_days).toBe(14)
    expect(result.extension_count).toBe(0)
    expect(result.extended_at).toBeNull()
    expect(result.last_reopened_by).toBe('admin-2')
    expect(result.funding_expires_at).toBe('2026-06-15T12:00:00.000Z')
    expect(result.reopen_history).toHaveLength(2)
    expect(result.reopen_history[1]).toMatchObject({
      sequence: 2,
      funding_window_days: 14,
      reopened_by: 'admin-2',
    })
  })
})
