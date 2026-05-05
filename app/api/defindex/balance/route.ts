import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { sumUnderlyingDisplayAmounts } from '@/lib/defindex/amounts'
import { defindexErrorMessage } from '@/lib/defindex/api-error'
import {
  getDefindexSupportedNetwork,
  getMercatoVaultContractId,
  isDefindexConfigured,
} from '@/lib/defindex/config'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'
import { isLikelyStellarAccountId, isLikelyStellarContractId } from '@/lib/defindex/stellar-address'

export const dynamic = 'force-dynamic'

/** GET /api/defindex/balance?caller=G… — user position in the Mercato vault. */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const caller = searchParams.get('caller')?.trim() ?? ''
  if (!caller || !isLikelyStellarAccountId(caller)) {
    return NextResponse.json({ error: 'A valid Stellar account address `caller` is required.' }, { status: 400 })
  }

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const balance = await sdk.getVaultBalance(vaultAddress, caller, network)
    const underlying = Array.isArray(balance.underlyingBalance) ? balance.underlyingBalance : []
    const underlyingTotal = sumUnderlyingDisplayAmounts(underlying)

    return NextResponse.json({
      vaultAddress,
      network,
      dfTokens: balance.dfTokens,
      underlyingBalance: underlying,
      /** Sum of underlying assets converted with `NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS` (default 7). */
      underlyingTotal,
    })
  } catch (error) {
    return NextResponse.json({ error: defindexErrorMessage(error) }, { status: 502 })
  }
}
