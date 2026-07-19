import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { getDefindexSupportedNetwork } from '@/lib/defindex/config'
import {
  defindexErrorResponse,
  requireDefindexConfigured,
  resolveSlippageBps,
  validateCaller,
  warnIfCallerMismatch,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'

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

  const configured = requireDefindexConfigured()
  if (!configured.ok) return configured.response
  const { vaultAddress } = configured

  const body = (await request.json().catch(() => null)) as Body | null

  const callerResult = validateCaller(body?.caller)
  if (!callerResult.ok) return callerResult.response
  const { caller } = callerResult
  await warnIfCallerMismatch(auth.userId, caller)

  if (typeof body?.shares !== 'number' || !Number.isFinite(body.shares) || body.shares <= 0) {
    return NextResponse.json({ error: 'Valid positive `shares` is required.' }, { status: 400 })
  }

  const slippageBps = resolveSlippageBps(body?.slippageBps)

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
    return defindexErrorResponse(error, 'withdraw-shares')
  }
}
