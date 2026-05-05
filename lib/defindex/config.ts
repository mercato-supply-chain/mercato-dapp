import { SupportedNetworks } from '@defindex/sdk'

/**
 * Mercato’s shared DeFindex vault contract id (Soroban `C…`).
 * Prefer server-only `MERCATO_DEFINDEX_VAULT_ADDRESS`; `NEXT_PUBLIC_*` stays for client display.
 */
export function getMercatoVaultContractId(): string {
  return (
    process.env.MERCATO_DEFINDEX_VAULT_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_MERCATO_DEFINDEX_VAULT_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim() ||
    ''
  )
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

/** Raw on-chain amounts (e.g. USDC) typically use 7 decimals on Stellar. */
export function getDefindexAssetDecimals(): number {
  const raw = process.env.NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS ?? '7'
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 7
}

export function isDefindexConfigured(): boolean {
  const vault = getMercatoVaultContractId()
  const key = getDefindexApiKey()
  return Boolean(vault && key)
}

/** DeFindex API key present (e.g. for admin create-vault or submit before env vault id exists). */
export function isDefindexApiConfigured(): boolean {
  return Boolean(getDefindexApiKey())
}
