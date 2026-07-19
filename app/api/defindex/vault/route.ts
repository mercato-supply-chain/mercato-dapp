import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { getDefindexSupportedNetwork } from '@/lib/defindex/config'
import {
  defindexErrorResponse,
  requireDefindexConfigured,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'
import { buildVaultMonitorPayload } from '@/lib/defindex/vault-monitor'

export const dynamic = 'force-dynamic'

/** GET /api/defindex/vault — public metadata for the Mercato vault (authenticated users). */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const configured = requireDefindexConfigured()
  if (!configured.ok) return configured.response
  const { vaultAddress } = configured

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const [info, apy] = await Promise.all([
      sdk.getVaultInfo(vaultAddress, network),
      sdk.getVaultAPY(vaultAddress, network),
    ])

    const monitor = buildVaultMonitorPayload(
      vaultAddress,
      vaultAddress,
      true,
      info,
      apy.apy,
    )

    return NextResponse.json({
      vaultAddress,
      network,
      name: info.name,
      symbol: info.symbol,
      feesBps: info.feesBps,
      assets: info.assets,
      totalManagedFunds: info.totalManagedFunds,
      /** APY value as returned by DeFindex (see SDK types). */
      apy: apy.apy,
      totals: monitor.totals,
      assetRows: monitor.assets,
      explorerContractUrl: monitor.explorerContractUrl,
    })
  } catch (error) {
    return defindexErrorResponse(error, 'vault')
  }
}
