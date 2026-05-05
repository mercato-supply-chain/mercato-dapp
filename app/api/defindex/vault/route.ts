import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { defindexErrorMessage } from '@/lib/defindex/api-error'
import {
  getDefindexSupportedNetwork,
  getMercatoVaultContractId,
  isDefindexConfigured,
} from '@/lib/defindex/config'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'
import { isLikelyStellarContractId } from '@/lib/defindex/stellar-address'

export const dynamic = 'force-dynamic'

/** GET /api/defindex/vault — public metadata for the Mercato vault (authenticated users). */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  if (!isDefindexConfigured()) {
    return NextResponse.json(
      { error: 'Mercato vault is not configured (missing vault id or API key).' },
      { status: 503 }
    )
  }

  const vaultAddress = getMercatoVaultContractId()
  if (!isLikelyStellarContractId(vaultAddress)) {
    return NextResponse.json({ error: 'Invalid vault contract id in environment.' }, { status: 500 })
  }

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const [info, apy] = await Promise.all([
      sdk.getVaultInfo(vaultAddress, network),
      sdk.getVaultAPY(vaultAddress, network),
    ])

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
    })
  } catch (error) {
    return NextResponse.json({ error: defindexErrorMessage(error) }, { status: 502 })
  }
}
