'use client'

import { createDedupedFetcher } from '@/lib/client/deduped-fetch'
import { hasClientVaultConfigured } from './client-config'
import type { MercatoVaultMeta } from '@/hooks/useDefindex'

type BalanceApiOk = {
  underlyingTotal: number
  underlyingTotalRaw?: number
  dfTokens: number
  vaultAddress: string
  network: string
}

type SacBalancePayload = {
  displayBalance?: number
  rawBalance?: string
}

/**
 * Extract an error message from a failed `fetch` Response (client side).
 *
 * Intentionally distinct from `api-error.ts#defindexErrorMessage`, which extracts
 * messages from caught `@defindex/sdk` exceptions on the server. This one parses
 * the `{ error }` JSON body our own route handlers return; that one inspects thrown
 * Error objects. Two call sites, two shapes — kept separate on purpose.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown }
    if (typeof data?.error === 'string' && data.error) return data.error
  } catch {
    /* ignore */
  }
  return `Request failed (${response.status})`
}

const vaultMetaRequest = createDedupedFetcher(
  async (): Promise<MercatoVaultMeta> => {
    const response = await fetch('/api/defindex/vault', { credentials: 'include' })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }
    return (await response.json()) as MercatoVaultMeta
  },
  () => 'vault-meta',
  60_000,
)

const vaultBalanceRequest = createDedupedFetcher(
  async (address: string): Promise<BalanceApiOk> => {
    const url = new URL('/api/defindex/balance', window.location.origin)
    url.searchParams.set('caller', address)
    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }
    return (await response.json()) as BalanceApiOk
  },
  (address) => `vault-balance:${address}`,
  8_000,
)

const sacBalanceRequest = createDedupedFetcher(
  async (address: string, assetContract: string): Promise<SacBalancePayload> => {
    const url = new URL('/api/stellar/sac-balance', window.location.origin)
    url.searchParams.set('account', address)
    url.searchParams.set('assetContract', assetContract)
    const response = await fetch(url.toString(), { credentials: 'include' })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }
    return (await response.json()) as SacBalancePayload
  },
  (address, assetContract) => `sac-balance:${address}:${assetContract}`,
  20_000,
)

function invalidateVaultDataCache(address: string, assetContract?: string) {
  vaultMetaRequest.invalidate()
  vaultBalanceRequest.invalidate(address)
  if (assetContract) {
    sacBalanceRequest.invalidate(address, assetContract)
  }
}

function isRateLimitMessage(message: string): boolean {
  return /rate limit/i.test(message)
}

export {
  readErrorMessage,
  hasClientVaultConfigured,
  vaultMetaRequest,
  vaultBalanceRequest,
  sacBalanceRequest,
  invalidateVaultDataCache,
  isRateLimitMessage,
}
export type { BalanceApiOk, SacBalancePayload }
