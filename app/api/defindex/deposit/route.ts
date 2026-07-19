import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { getDefindexSupportedNetwork } from '@/lib/defindex/config'
import {
  defindexErrorResponse,
  parseAmounts,
  requireDefindexConfigured,
  resolveSlippageBps,
  validateCaller,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'

export const dynamic = 'force-dynamic'

type DepositBody = {
  caller?: unknown
  amounts?: unknown
  invest?: unknown
  slippageBps?: unknown
}

/** POST /api/defindex/deposit — build unsigned deposit XDR for the connected user to sign. */
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const configured = requireDefindexConfigured()
  if (!configured.ok) return configured.response
  const { vaultAddress } = configured

  const body = (await request.json().catch(() => null)) as DepositBody | null

  const callerResult = validateCaller(body?.caller)
  if (!callerResult.ok) return callerResult.response
  const { caller } = callerResult

  const amountsResult = parseAmounts(body?.amounts)
  if (!amountsResult.ok) return amountsResult.response
  const { amounts } = amountsResult

  const invest = typeof body?.invest === 'boolean' ? body.invest : true
  const slippageBps = resolveSlippageBps(body?.slippageBps)

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const tx = await sdk.depositToVault(
      vaultAddress,
      { caller, amounts, invest, slippageBps },
      network
    )

    if (!tx.xdr) {
      return NextResponse.json(
        { error: 'DeFindex did not return transaction XDR for this deposit.' },
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
    return defindexErrorResponse(error, 'deposit')
  }
}
