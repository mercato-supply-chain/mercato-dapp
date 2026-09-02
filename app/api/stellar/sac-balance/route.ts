import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/route-auth'
import { isLikelyStellarAccountId, isLikelyStellarContractId } from '@/lib/defindex/stellar-address'
import { getSacTokenBalance } from '@/lib/stellar/sac-token-balance'

export const dynamic = 'force-dynamic'

/** GET /api/stellar/sac-balance?account=G…&assetContract=C… */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const account = searchParams.get('account')?.trim() ?? ''
  const assetContract = searchParams.get('assetContract')?.trim() ?? ''

  if (!account || !isLikelyStellarAccountId(account)) {
    return NextResponse.json({ error: 'Valid account (G…) is required.' }, { status: 400 })
  }
  if (!assetContract || !isLikelyStellarContractId(assetContract)) {
    return NextResponse.json({ error: 'Valid assetContract (C…) is required.' }, { status: 400 })
  }

  const network = process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'

  try {
    const balance = await getSacTokenBalance(account, assetContract, network)
    return NextResponse.json(balance)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load SAC token balance.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
