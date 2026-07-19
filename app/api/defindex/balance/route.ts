import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { parseVaultBalancePayload } from '@/lib/defindex/amounts'
import { getDefindexSupportedNetwork } from '@/lib/defindex/config'
import {
  defindexErrorResponse,
  requireDefindexConfigured,
  validateCaller,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'

export const dynamic = 'force-dynamic'

/** GET /api/defindex/balance?caller=G… — user position in the Mercato vault. */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const configured = requireDefindexConfigured()
  if (!configured.ok) return configured.response
  const { vaultAddress } = configured

  const { searchParams } = new URL(request.url)
  const callerResult = validateCaller(searchParams.get('caller'))
  if (!callerResult.ok) return callerResult.response
  const { caller } = callerResult

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const balance = await sdk.getVaultBalance(vaultAddress, caller, network)
    const parsed = parseVaultBalancePayload(balance)

    return NextResponse.json({
      vaultAddress,
      network,
      dfTokens: parsed.dfTokensRaw,
      underlyingBalance: parsed.underlyingRawPerAsset,
      underlyingTotalRaw: parsed.underlyingTotalRaw,
      underlyingTotal: parsed.underlyingTotalDisplay,
    })
  } catch (error) {
    return defindexErrorResponse(error, 'balance')
  }
}
