/**
 * Client-safe DeFindex config resolution.
 *
 * This module MUST NOT import `@defindex/sdk` (a heavy, server-only package) so it
 * can be imported from both client components and server code. It is the single
 * source of truth for public (`NEXT_PUBLIC_*`) env resolution shared by the server
 * `config.ts`, the client `vault-cache.ts`, and the pure `amounts.ts` helpers.
 */

/** Raw on-chain amounts (e.g. USDC) typically use 7 decimals on Stellar. */
export function getDefindexAssetDecimals(): number {
  const raw = process.env.NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS ?? '7'
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 7
}

/**
 * Public (client-visible) Mercato vault contract id.
 * Server code layers the server-only `MERCATO_DEFINDEX_VAULT_ADDRESS` on top of this
 * via `config.ts#getMercatoVaultContractId()`; both share this single fallback chain.
 */
export function getClientVaultContractId(): string {
  return (
    process.env.NEXT_PUBLIC_MERCATO_DEFINDEX_VAULT_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim() ||
    ''
  )
}

/** Whether a client-visible vault contract id is configured. */
export function hasClientVaultConfigured(): boolean {
  return Boolean(getClientVaultContractId())
}
