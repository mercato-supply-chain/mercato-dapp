import type { DealRow } from '@/lib/deals'
import { getDealFundingStatus } from '@/lib/deals'

export type DealReopenHistoryEntry = {
  sequence: number
  previous_expiration_at: string | null
  new_expiration_at: string
  reopened_at: string
  reopened_by: string
  funding_window_days: number
}

type ReopenDealRow = Pick<
  DealRow,
  | 'status'
  | 'investor_id'
  | 'funded_at'
  | 'funding_expires_at'
  | 'extension_count'
  | 'reopen_count'
  | 'reopen_history'
>

export function isDealFundingExpired(
  row: Pick<
    DealRow,
    'status' | 'investor_id' | 'funded_at' | 'funding_expires_at' | 'extension_count'
  >,
  nowMs = Date.now(),
): boolean {
  return getDealFundingStatus(row, nowMs) === 'expired'
}

export function buildDealReopenUpdate(
  existingDeal: ReopenDealRow,
  fundingWindowDays: number,
  reopenedBy: string,
  nowMs = Date.now(),
): {
  funding_expires_at: string
  funding_window_days: number
  reopen_count: number
  last_reopened_at: string
  last_reopened_by: string
  reopen_history: DealReopenHistoryEntry[]
  extension_count: number
  extended_at: null
  updated_at: string
} {
  const nowIso = new Date(nowMs).toISOString()
  const nextExpiration = new Date(
    nowMs + fundingWindowDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  const previousHistory = Array.isArray(existingDeal.reopen_history)
    ? (existingDeal.reopen_history as DealReopenHistoryEntry[])
    : []
  const reopenCount = (existingDeal.reopen_count ?? 0) + 1

  const historyEntry: DealReopenHistoryEntry = {
    sequence: reopenCount,
    previous_expiration_at: existingDeal.funding_expires_at ?? null,
    new_expiration_at: nextExpiration,
    reopened_at: nowIso,
    reopened_by: reopenedBy,
    funding_window_days: fundingWindowDays,
  }

  return {
    funding_expires_at: nextExpiration,
    funding_window_days: fundingWindowDays,
    reopen_count: reopenCount,
    last_reopened_at: nowIso,
    last_reopened_by: reopenedBy,
    reopen_history: [...previousHistory, historyEntry],
    extension_count: 0,
    extended_at: null,
    updated_at: nowIso,
  }
}
