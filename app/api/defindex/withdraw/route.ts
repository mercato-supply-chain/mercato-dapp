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

type WithdrawBody = {
  caller?: unknown
  amounts?: unknown
  slippageBps?: unknown
}

function parseAmounts(value: unknown): number[] | Response {
  if (!Array.isArray(value) || value.length === 0) {
    return NextResponse.json({ error: '`amounts` must be a non-empty number array.' }, { status: 400 })
  }
  const amounts: number[] = []
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item) || item <= 0) {
      return NextResponse.json({ error: 'Each `amounts` entry must be a positive finite number.' }, { status: 400 })
    }
    amounts.push(item)
  }
  return amounts
}

/** POST /api/defindex/withdraw — build unsigned withdraw XDR for the connected user to sign. */
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

  const body = (await request.json().catch(() => null)) as WithdrawBody | null
  const caller =
    typeof body?.caller === 'string' ? body.caller.trim() : ''
  if (!caller || !isLikelyStellarAccountId(caller)) {
    return NextResponse.json({ error: 'Valid `caller` (Stellar account) is required.' }, { status: 400 })
  }

  const amountsResult = parseAmounts(body?.amounts)
  if (amountsResult instanceof Response) return amountsResult
  const amounts = amountsResult

  const slippageBps =
    typeof body?.slippageBps === 'number' && Number.isFinite(body.slippageBps)
      ? body.slippageBps
      : 100

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const tx = await sdk.withdrawFromVault(
      vaultAddress,
      { caller, amounts, slippageBps },
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
