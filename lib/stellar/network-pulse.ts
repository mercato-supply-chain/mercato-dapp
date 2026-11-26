import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import {
  getAppStellarNetwork,
  getStellarNetworkConfig,
  type StellarNetwork,
} from '@/lib/stellar/network-config'
import { stellarExpertExplorerBase } from '@/lib/stellar/explorer'

export type StellarNetworkPulse = {
  network: StellarNetwork
  healthy: boolean
  ledger: number | null
  protocolVersion: number | null
  explorerUrl: string
}

type RpcEnvelope<T> = {
  result?: T
  error?: { message?: string }
}

async function rpcCall<T>(rpcUrl: string, method: string, id: number): Promise<T | null> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method }),
    cache: 'no-store',
  })
  if (!response.ok) return null
  const payload = (await response.json()) as RpcEnvelope<T>
  if (payload.error) return null
  return payload.result ?? null
}

async function fetchStellarNetworkPulse(): Promise<StellarNetworkPulse> {
  const network = getAppStellarNetwork()
  const { rpcUrl } = getStellarNetworkConfig(network)
  const explorerUrl = stellarExpertExplorerBase(network)

  const [health, latest] = await Promise.all([
    rpcCall<{
      status?: string
      latestLedger?: number
    }>(rpcUrl, 'getHealth', 1),
    rpcCall<{
      sequence?: number
      protocolVersion?: number
    }>(rpcUrl, 'getLatestLedger', 2),
  ])

  const healthy = health?.status === 'healthy'
  const ledger = latest?.sequence ?? health?.latestLedger ?? null
  const protocolVersion = latest?.protocolVersion ?? null

  return {
    network,
    healthy: healthy && ledger != null,
    ledger,
    protocolVersion,
    explorerUrl,
  }
}

const getCachedStellarNetworkPulse = unstable_cache(
  fetchStellarNetworkPulse,
  ['stellar-network-pulse-v1'],
  { revalidate: 12 },
)

const FALLBACK_PULSE: StellarNetworkPulse = {
  network: 'testnet',
  healthy: false,
  ledger: null,
  protocolVersion: null,
  explorerUrl: stellarExpertExplorerBase('testnet'),
}

export const getStellarNetworkPulse = cache(async (): Promise<StellarNetworkPulse> => {
  try {
    return await getCachedStellarNetworkPulse()
  } catch (error) {
    console.error('[getStellarNetworkPulse]', error)
    return {
      ...FALLBACK_PULSE,
      network: getAppStellarNetwork(),
      explorerUrl: stellarExpertExplorerBase(),
    }
  }
})
