/** Blend testnet USDC SAC — what DeFindex vaults deposit (not Circle USDC). */
export const BLEND_TESTNET_USDC_CONTRACT =
  'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU'

/** Blend pool issuer on testnet (classic assets from testnet.blend.capital faucet). */
export const BLEND_TESTNET_POOL_ISSUER = 'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56'

export const BLEND_TESTNET_USDC_CLASSIC = `USDC:${BLEND_TESTNET_POOL_ISSUER}`

export const BLEND_TESTNET_FAUCET_URL = 'https://testnet.blend.capital/'

export type ClassicBalanceHint = {
  code: string
  issuer: string
  balance: string
  isBlendPoolAsset: boolean
}

export type VaultAssetTrustlineCopyTarget = {
  id: string
  label: string
  value: string
  description?: string
}

export function isMissingTrustlineError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('missingtrustline') ||
    m.includes('missing_trustline') ||
    m.includes('tokenerrors.missingtrustline') ||
    m.includes('trustline')
  )
}

export function getVaultAssetTrustlineCopyTargets(
  assetContract: string,
  symbol?: string,
  name?: string,
): VaultAssetTrustlineCopyTarget[] {
  const label = symbol || name || 'Vault asset'
  const targets: VaultAssetTrustlineCopyTarget[] = [
    {
      id: 'contract',
      label: 'Asset contract (SAC)',
      value: assetContract,
      description: 'Paste in Freighter → Add asset, or use “Add trustline” below.',
    },
  ]

  if (assetContract === BLEND_TESTNET_USDC_CONTRACT || symbol?.toUpperCase().includes('USDC')) {
    targets.push({
      id: 'classic-usdc',
      label: 'Blend pool USDC (classic, from faucet)',
      value: BLEND_TESTNET_USDC_CLASSIC,
      description: 'Faucet USDC — useful on Blend, but not the same as the vault SAC asset below.',
    })
    targets.push({
      id: 'faucet',
      label: 'Blend testnet faucet',
      value: BLEND_TESTNET_FAUCET_URL,
      description: 'Get test USDC / wETH / wBTC — still add SAC trust for the vault contract.',
    })
  }

  return targets
}

/** Minimal structural shape of Horizon classic balance lines. */
export type HorizonBalanceLike = {
  asset_type?: string
  asset_code?: string
  asset_issuer?: string
  balance?: string
}

/** Classic Horizon balances from the Blend pool (faucet credits these). */
export function extractClassicBlendBalances(
  balances: readonly HorizonBalanceLike[],
): ClassicBalanceHint[] {
  return balances
    .filter((b) => b.asset_type !== 'native' && b.asset_type !== 'liquidity_pool_shares')
    .map((b) => ({
      code: String(b.asset_code ?? ''),
      issuer: String(b.asset_issuer ?? ''),
      balance: String(b.balance ?? '0'),
      isBlendPoolAsset: String(b.asset_issuer ?? '') === BLEND_TESTNET_POOL_ISSUER,
    }))
    .filter((b) => b.isBlendPoolAsset && b.code)
}

/**
 * Horizon classic balances are NOT enough for Soroban SAC vault deposits.
 * Vault needs SAC `trust()` on the C… contract (use “Add trustline (sign)”).
 */
export function horizonIndicatesVaultSacTrust(
  _balances: readonly HorizonBalanceLike[],
  _vaultAssetContract: string,
): boolean {
  return false
}
