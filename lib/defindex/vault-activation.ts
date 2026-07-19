import { rawToDisplayAmount } from './amounts'

/** Minimum raw units (stroops) to initialize a new DeFindex vault. */
export const VAULT_MIN_INIT_DEPOSIT_RAW = 1001

/**
 * Human-readable minimum first deposit. Delegates to the canonical
 * {@link rawToDisplayAmount} so vault-activation shares one decimals source
 * (defaults to `getDefindexAssetDecimals()` when `decimals` is omitted).
 */
export function minInitDepositDisplay(decimals?: number): number {
  return rawToDisplayAmount(VAULT_MIN_INIT_DEPOSIT_RAW, decimals)
}
