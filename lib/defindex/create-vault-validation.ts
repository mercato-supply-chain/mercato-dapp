import type { CreateVaultParams } from '@defindex/sdk'
import { isLikelyStellarAccountId, isLikelyStellarContractId } from './stellar-address'

/**
 * Deep validation for admin `create-vault` requests.
 *
 * The previous `isCreateVaultParams` type-guard only checked coarse shapes
 * (`typeof roles === 'object'`, `assets.length > 0`) and let malformed role
 * addresses, out-of-range fees, and bad strategy shapes reach the DeFindex API
 * before failing. This validates every field up front and returns a precise reason.
 *
 * Kept hand-rolled (rather than introducing `zod`, which is declared but unused in
 * this codebase) so validation stays consistent with the other DeFindex routes.
 */

/** DeFindex caps fee basis points at 9000 (90%). */
export const MAX_VAULT_FEE_BPS = 9000
export const VAULT_NAME_MAX = 32
export const VAULT_SYMBOL_MAX = 10

export type CreateVaultValidation =
  | { ok: true; params: CreateVaultParams }
  | { ok: false; error: string }

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= max
}

const ROLE_KEYS = ['emergencyManager', 'rebalanceManager', 'feeReceiver', 'manager'] as const

export function validateCreateVaultParams(value: unknown): CreateVaultValidation {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Vault config must be an object.' }
  }
  const o = value as Record<string, unknown>

  if (typeof o.caller !== 'string' || !isLikelyStellarAccountId(o.caller.trim())) {
    return { ok: false, error: '`caller` must be a valid Stellar account (G…).' }
  }

  if (!isNonEmptyString(o.name, VAULT_NAME_MAX)) {
    return { ok: false, error: `\`name\` must be a string of 1–${VAULT_NAME_MAX} characters.` }
  }
  if (!isNonEmptyString(o.symbol, VAULT_SYMBOL_MAX)) {
    return { ok: false, error: `\`symbol\` must be a string of 1–${VAULT_SYMBOL_MAX} characters.` }
  }

  if (
    typeof o.vaultFeeBps !== 'number' ||
    !Number.isInteger(o.vaultFeeBps) ||
    o.vaultFeeBps < 0 ||
    o.vaultFeeBps > MAX_VAULT_FEE_BPS
  ) {
    return { ok: false, error: `\`vaultFeeBps\` must be an integer between 0 and ${MAX_VAULT_FEE_BPS}.` }
  }

  if (typeof o.upgradable !== 'boolean') {
    return { ok: false, error: '`upgradable` must be a boolean.' }
  }

  if (!o.roles || typeof o.roles !== 'object') {
    return { ok: false, error: '`roles` must be an object.' }
  }
  const roles = o.roles as Record<string, unknown>
  for (const key of ROLE_KEYS) {
    const addr = roles[key]
    if (typeof addr !== 'string' || !isLikelyStellarAccountId(addr.trim())) {
      return { ok: false, error: `\`roles.${key}\` must be a valid Stellar account (G…).` }
    }
  }

  if (!Array.isArray(o.assets) || o.assets.length === 0) {
    return { ok: false, error: '`assets` must be a non-empty array.' }
  }
  for (let i = 0; i < o.assets.length; i++) {
    const asset = o.assets[i]
    if (!asset || typeof asset !== 'object') {
      return { ok: false, error: `\`assets[${i}]\` must be an object.` }
    }
    const a = asset as Record<string, unknown>
    if (typeof a.address !== 'string' || !isLikelyStellarContractId(a.address.trim())) {
      return { ok: false, error: `\`assets[${i}].address\` must be a valid contract id (C…).` }
    }
    if (!Array.isArray(a.strategies) || a.strategies.length === 0) {
      return { ok: false, error: `\`assets[${i}].strategies\` must be a non-empty array.` }
    }
    for (let j = 0; j < a.strategies.length; j++) {
      const strategy = a.strategies[j]
      if (!strategy || typeof strategy !== 'object') {
        return { ok: false, error: `\`assets[${i}].strategies[${j}]\` must be an object.` }
      }
      const s = strategy as Record<string, unknown>
      if (typeof s.address !== 'string' || !isLikelyStellarContractId(s.address.trim())) {
        return { ok: false, error: `\`assets[${i}].strategies[${j}].address\` must be a valid contract id (C…).` }
      }
      if (typeof s.name !== 'string' || s.name.trim().length === 0) {
        return { ok: false, error: `\`assets[${i}].strategies[${j}].name\` must be a non-empty string.` }
      }
      if (typeof s.paused !== 'boolean') {
        return { ok: false, error: `\`assets[${i}].strategies[${j}].paused\` must be a boolean.` }
      }
    }
  }

  if (o.soroswapRouter !== undefined) {
    if (typeof o.soroswapRouter !== 'string' || !isLikelyStellarContractId(o.soroswapRouter.trim())) {
      return { ok: false, error: '`soroswapRouter` must be a valid contract id (C…) when provided.' }
    }
  }

  return { ok: true, params: value as CreateVaultParams }
}
