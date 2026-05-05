import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { defindexErrorMessage } from '@/lib/defindex/api-error'
import {
  getDefindexSupportedNetwork,
  getMercatoVaultContractId,
  isDefindexConfigured,
} from '@/lib/defindex/config'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'
import { isLikelyStellarAccountId, isLikelyStellarContractId } from '@/lib/defindex/stellar-address'

export const dynamic = 'force-dynamic'

type Body = {
  caller?: unknown
  shares?: unknown
  slippageBps?: unknown
}

/** POST /api/defindex/withdraw-shares — burn dfTokens for underlying (unsigned XDR). */
export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as Body | null
  const caller =
    typeof body?.caller === 'string' ? body.caller.trim() : ''
  if (!caller || !isLikelyStellarAccountId(caller)) {
    return NextResponse.json({ error: 'Valid `caller` (Stellar account) is required.' }, { status: 400 })
  }

  if (typeof body?.shares !== 'number' || !Number.isFinite(body.shares) || body.shares <= 0) {
    return NextResponse.json({ error: 'Valid positive `shares` is required.' }, { status: 400 })
  }

  const slippageBps =
    typeof body?.slippageBps === 'number' && Number.isFinite(body.slippageBps)
      ? body.slippageBps
      : 100

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const tx = await sdk.withdrawShares(
      vaultAddress,
      { caller, shares: body.shares, slippageBps },
      network
    )

    if (!tx.xdr) {
      return NextResponse.json(
        { error: 'DeFindex did not return transaction XDR for this withdrawal.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      xdr: tx.xdr,
      functionName: tx.functionName,
      simulationResponse: tx.simulationResponse,
      vaultAddress,
      network,
    })
  } catch (error) {
    return NextResponse.json({ error: defindexErrorMessage(error) }, { status: 502 })
  }
}
