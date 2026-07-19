import { SupportedNetworks } from '@defindex/sdk'
import { getClientVaultContractId, getDefindexAssetDecimals } from './client-config'

/**
 * Mercato’s shared DeFindex vault contract id (Soroban `C…`).
 * Prefer server-only `MERCATO_DEFINDEX_VAULT_ADDRESS`; the `NEXT_PUBLIC_*` fallback
 * chain lives in `client-config.ts` and is shared with the client (single source of truth).
 */
export function getMercatoVaultContractId(): string {
  return process.env.MERCATO_DEFINDEX_VAULT_ADDRESS?.trim() || getClientVaultContractId()
}

/**
 * Server-side API key only. Do not expose via `NEXT_PUBLIC_*` in production.
 * `NEXT_PUBLIC_DEFINDEX_API_KEY` is accepted only for backward compatibility during migration.
 */
export function getDefindexApiKey(): string {
  return (
    process.env.DEFINDEX_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_DEFINDEX_API_KEY?.trim() ||
    ''
  )
}

export function getDefindexBaseUrl(): string | undefined {
  const url =
    process.env.DEFINDEX_API_URL?.trim() || process.env.NEXT_PUBLIC_DEFINDEX_API_URL?.trim()
  return url || undefined
}

export function getDefindexSupportedNetwork(): SupportedNetworks {
  return process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet'
    ? SupportedNetworks.MAINNET
    : SupportedNetworks.TESTNET
}

/**
 * Raw on-chain amounts (e.g. USDC) typically use 7 decimals on Stellar.
 * Re-exported from the client-safe `client-config.ts` so server callers keep the
 * same import surface while sharing one implementation.
 */
export { getDefindexAssetDecimals }

export function isDefindexConfigured(): boolean {
  const vault = getMercatoVaultContractId()
  const key = getDefindexApiKey()
  return Boolean(vault && key)
}

/** DeFindex API key present (e.g. for admin create-vault or submit before env vault id exists). */
export function isDefindexApiConfigured(): boolean {
  return Boolean(getDefindexApiKey())
}
