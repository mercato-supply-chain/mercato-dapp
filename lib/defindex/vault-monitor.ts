import { SupportedNetworks, type VaultInfoResponse } from '@defindex/sdk'
import { rawToDisplayAmount } from './amounts'
import { getDefindexSupportedNetwork } from './config'
import { isLikelyStellarContractId } from './stellar-address'

export type VaultMonitorAlertSeverity = 'critical' | 'warning' | 'info'

export type VaultMonitorAlert = {
  id: string
  severity: VaultMonitorAlertSeverity
  title: string
  description: string
}

export type VaultMonitorStrategyRow = {
  address: string
  name: string
  paused: boolean
  allocatedDisplay: number
  allocatedRaw: string
}

export type VaultMonitorAssetRow = {
  address: string
  name: string
  symbol: string
  idleDisplay: number
  investedDisplay: number
  totalDisplay: number
  idleRaw: string
  investedRaw: string
  totalRaw: string
  idlePercent: number
  strategies: VaultMonitorStrategyRow[]
}

export type VaultMonitorPayload = {
  fetchedAt: string
  vaultAddress: string
  configuredVaultAddress: string | null
  envConfigured: boolean
  addressMatchesEnv: boolean
  network: string
  apiHealthy: boolean
  name: string
  symbol: string
  apy: number
  feesBps: { vaultFee: number; defindexFee: number }
  roles: VaultInfoResponse['roles']
  assets: VaultMonitorAssetRow[]
  totals: {
    tvlDisplay: number
    idleDisplay: number
    investedDisplay: number
    idlePercent: number
  }
  alerts: VaultMonitorAlert[]
  explorerContractUrl: string
}

function explorerBase(network: string): string {
  const net = network === 'mainnet' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${net}`
}

export function resolveMonitorVaultAddress(
  configuredVault: string,
  override?: string | null,
): { vaultAddress: string | null; error?: string } {
  const overrideTrim = override?.trim()
  if (overrideTrim) {
    if (!isLikelyStellarContractId(overrideTrim)) {
      return { vaultAddress: null, error: 'Invalid vault contract address.' }
    }
    return { vaultAddress: overrideTrim }
  }
  if (!configuredVault.trim()) {
    return { vaultAddress: null, error: 'No vault configured in environment.' }
  }
  if (!isLikelyStellarContractId(configuredVault)) {
    return { vaultAddress: null, error: 'Invalid vault contract id in environment.' }
  }
  return { vaultAddress: configuredVault.trim() }
}

function findAssetMeta(
  info: VaultInfoResponse,
  assetAddress: string,
): { name: string; symbol: string; strategies: VaultInfoResponse['assets'][0]['strategies'] } {
  const match = info.assets.find((a) => a.address === assetAddress)
  return {
    name: match?.name ?? assetAddress.slice(0, 8) + '…',
    symbol: match?.symbol ?? '—',
    strategies: match?.strategies ?? [],
  }
}

export function buildVaultMonitorAlerts(
  info: VaultInfoResponse,
  assets: VaultMonitorAssetRow[],
  totals: VaultMonitorPayload['totals'],
  opts: {
    envConfigured: boolean
    addressMatchesEnv: boolean
    apiHealthy: boolean
  },
): VaultMonitorAlert[] {
  const alerts: VaultMonitorAlert[] = []

  if (!opts.apiHealthy) {
    alerts.push({
      id: 'api-unhealthy',
      severity: 'critical',
      title: 'DeFindex API unreachable',
      description: 'Health check failed. Vault data may be stale until the API is reachable again.',
    })
  }

  if (!opts.envConfigured) {
    alerts.push({
      id: 'env-missing',
      severity: 'critical',
      title: 'Vault not wired to the app',
      description:
        'Set NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS and MERCATO_DEFINDEX_VAULT_ADDRESS, then redeploy so investors can use this vault.',
    })
  } else if (!opts.addressMatchesEnv) {
    alerts.push({
      id: 'env-mismatch',
      severity: 'warning',
      title: 'Monitoring a different contract than production',
      description:
        'The address you are viewing does not match the configured env vault. Users still interact with the env address.',
    })
  }

  if (totals.tvlDisplay <= 0) {
    alerts.push({
      id: 'zero-tvl',
      severity: 'warning',
      title: 'No TVL detected',
      description:
        'Total managed funds are zero. Complete first deposit and rebalance after deployment before opening to investors.',
    })
  } else if (totals.idlePercent >= 40) {
    alerts.push({
      id: 'high-idle',
      severity: 'warning',
      title: 'High idle cash',
      description: `${totals.idlePercent.toFixed(0)}% of vault assets are idle (not invested in strategies). Consider rebalancing.`,
    })
  }

  for (const asset of assets) {
    for (const strategy of asset.strategies) {
      if (strategy.paused) {
        alerts.push({
          id: `paused-${strategy.address}`,
          severity: 'critical',
          title: `Strategy paused: ${strategy.name}`,
          description: `Asset ${asset.symbol} — ${strategy.address}. Paused strategies cannot receive new allocations.`,
        })
      }
    }
  }

  const configuredStrategies = info.assets.flatMap((a) => a.strategies)
  if (configuredStrategies.length === 0) {
    alerts.push({
      id: 'no-strategies',
      severity: 'warning',
      title: 'No strategies configured',
      description: 'This vault has assets but no linked DeFindex strategies.',
    })
  }

  if (info.apy === 0 && totals.investedDisplay > 0) {
    alerts.push({
      id: 'zero-apy',
      severity: 'info',
      title: 'APY reads as 0%',
      description: 'Yield may not be reported yet, or the vault needs more activity before APY is meaningful.',
    })
  }

  return alerts
}

export function buildVaultMonitorPayload(
  vaultAddress: string,
  configuredVaultAddress: string,
  apiHealthy: boolean,
  info: VaultInfoResponse,
  apyFromApi: number,
): VaultMonitorPayload {
  const network =
    getDefindexSupportedNetwork() === SupportedNetworks.MAINNET ? 'mainnet' : 'testnet'
  const envConfigured = Boolean(configuredVaultAddress.trim())
  const addressMatchesEnv =
    envConfigured && configuredVaultAddress.trim() === vaultAddress

  const assets: VaultMonitorAssetRow[] = (info.totalManagedFunds ?? []).map((mf) => {
    const meta = findAssetMeta(info, mf.asset)
    const idleDisplay = rawToDisplayAmount(mf.idle_amount)
    const investedDisplay = rawToDisplayAmount(mf.invested_amount)
    const totalDisplay = rawToDisplayAmount(mf.total_amount)
    const idlePercent = totalDisplay > 0 ? (idleDisplay / totalDisplay) * 100 : 0

    const strategyByAddress = new Map(meta.strategies.map((s) => [s.address, s]))

    const strategies: VaultMonitorStrategyRow[] = (mf.strategy_allocations ?? []).map((alloc) => {
      const cfg = strategyByAddress.get(alloc.strategy_address)
      return {
        address: alloc.strategy_address,
        name: cfg?.name ?? alloc.strategy_address.slice(0, 8) + '…',
        paused: alloc.paused ?? cfg?.paused ?? false,
        allocatedDisplay: rawToDisplayAmount(alloc.amount),
        allocatedRaw: alloc.amount,
      }
    })

    for (const s of meta.strategies) {
      if (!strategies.some((row) => row.address === s.address)) {
        strategies.push({
          address: s.address,
          name: s.name,
          paused: s.paused,
          allocatedDisplay: 0,
          allocatedRaw: '0',
        })
      }
    }

    return {
      address: mf.asset,
      name: meta.name,
      symbol: meta.symbol,
      idleDisplay,
      investedDisplay,
      totalDisplay,
      idleRaw: mf.idle_amount,
      investedRaw: mf.invested_amount,
      totalRaw: mf.total_amount,
      idlePercent,
      strategies,
    }
  })

  const totals = assets.reduce(
    (acc, a) => ({
      tvlDisplay: acc.tvlDisplay + a.totalDisplay,
      idleDisplay: acc.idleDisplay + a.idleDisplay,
      investedDisplay: acc.investedDisplay + a.investedDisplay,
      idlePercent: 0,
    }),
    { tvlDisplay: 0, idleDisplay: 0, investedDisplay: 0, idlePercent: 0 },
  )
  totals.idlePercent = totals.tvlDisplay > 0 ? (totals.idleDisplay / totals.tvlDisplay) * 100 : 0

  const payloadBase = {
    fetchedAt: new Date().toISOString(),
    vaultAddress,
    configuredVaultAddress: configuredVaultAddress.trim() || null,
    envConfigured,
    addressMatchesEnv,
    network,
    apiHealthy,
    name: info.name,
    symbol: info.symbol,
    apy: apyFromApi ?? info.apy ?? 0,
    feesBps: info.feesBps,
    roles: info.roles,
    assets,
    totals,
    explorerContractUrl: `${explorerBase(network)}/contract/${vaultAddress}`,
  }

  return {
    ...payloadBase,
    alerts: buildVaultMonitorAlerts(info, assets, totals, {
      envConfigured,
      addressMatchesEnv,
      apiHealthy,
    }),
  }
}
