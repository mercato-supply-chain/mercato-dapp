import { getDefindexAssetDecimals } from './config'

/** Convert raw vault underlying amounts (per asset) to a single display number. */
export function sumUnderlyingDisplayAmounts(rawPerAsset: number[]): number {
  if (!rawPerAsset?.length) return 0
  const decimals = getDefindexAssetDecimals()
  const scale = 10 ** decimals
  return rawPerAsset.reduce((sum, raw) => {
    if (!Number.isFinite(raw)) return sum
    return sum + raw / scale
  }, 0)
}
