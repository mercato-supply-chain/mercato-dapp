/**
 * RWA funding configuration.
 *
 * Everything the server needs to know about the RWA deployment is resolved
 * here, server-side. The client never supplies a network, contract address,
 * asset id or token: those come from the database row and this configuration,
 * and are re-checked against the chain before anything is projected.
 */

import { getAppStellarNetwork, type StellarNetwork } from '@/lib/stellar/network-config'

export type RwaConfig = {
  network: StellarNetwork
  networkPassphrase: string
  rpcUrl: string
  /** Registry contract that owns asset terms (contracts/credit-registry). */
  registryContractId: string | null
  /**
   * USDC Stellar Asset Contract address the funding pools are denominated in.
   *
   * The registry only accepts its own USDC SAC when an asset is registered, and
   * the pool freezes that token in its terms, so the token cannot change at
   * call time. Pinning it here still guards the unit conversion: a database
   * row that claims a different token or a different number of decimals would
   * make the server compute the wrong principal.
   */
  usdcSacAddress: string | null
  /** Whether the RWA funding path is enabled for this deployment. */
  enabled: boolean
  /** Registry admin that must sign register_asset and create_funding_pool. */
  registryAdminAddress: string | null
  /** Platform account that receives the funding fee and excess. */
  platformAddress: string | null
  /** Classic USDC issuer recorded on the frozen financial snapshot. */
  usdcIssuer: string | null
}

function readContractId(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Resolve the RWA configuration from the environment.
 *
 * `RWA_REGISTRY_CONTRACT_ID` is optional: assets carry their own registry and
 * pool contract ids, so the server can operate per-asset without a global
 * default. It is only used to sanity check that a submitted asset belongs to
 * the configured registry.
 */
export function getRwaConfig(): RwaConfig {
  const network = getAppStellarNetwork()
  const rpcUrl =
    process.env.RWA_SOROBAN_RPC_URL ??
    (network === 'mainnet'
      ? 'https://soroban-rpc.mainnet.stellar.org'
      : 'https://soroban-testnet.stellar.org')

  return {
    network,
    networkPassphrase:
      network === 'mainnet'
        ? 'Public Global Stellar Network ; September 2015'
        : 'Test SDF Network ; September 2015',
    rpcUrl,
    registryContractId: readContractId(process.env.RWA_REGISTRY_CONTRACT_ID),
    usdcSacAddress: readContractId(process.env.RWA_USDC_SAC_ADDRESS),
    enabled: process.env.RWA_ENABLED === 'true',
    registryAdminAddress: readContractId(process.env.RWA_REGISTRY_ADMIN_ADDRESS),
    platformAddress: readContractId(process.env.NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS),
    usdcIssuer: readContractId(process.env.NEXT_PUBLIC_USDC_ISSUER),
  }
}

/** Stellar contract ids are 56-character uppercase hex strings (C…X). */
export function isValidContractId(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[C][0-9A-Z]{55}$/.test(value.trim().toUpperCase())
}

/** Registry asset ids are 32-byte hex strings (64 characters). */
export function isValidAssetId(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[0-9A-Fa-f]{64}$/.test(value.trim())
}

/** Stellar addresses are 56-character uppercase alphanumeric strings. */
export function isValidStellarAddress(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[G][0-9A-Z]{55}$/.test(value.trim().toUpperCase())
}
