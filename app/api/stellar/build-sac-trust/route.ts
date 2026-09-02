import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/route-auth'
import { buildSacTrustTransactionXdr } from '@/lib/stellar/build-sac-trust'
import { isLikelyStellarContractId } from '@/lib/defindex/stellar-address'

export const dynamic = 'force-dynamic'

type Body = {
  sourceAccount?: unknown
  assetContract?: unknown
}

/** POST /api/stellar/build-sac-trust — unsigned SAC `trust()` tx for the connected account. */
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Body | null
  const sourceAccount = typeof body?.sourceAccount === 'string' ? body.sourceAccount.trim() : ''
  const assetContract = typeof body?.assetContract === 'string' ? body.assetContract.trim() : ''

  if (!sourceAccount) {
    return NextResponse.json({ error: 'sourceAccount is required.' }, { status: 400 })
  }
  if (!assetContract || !isLikelyStellarContractId(assetContract)) {
    return NextResponse.json({ error: 'Valid assetContract (C…) is required.' }, { status: 400 })
  }

  const network = process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'

  try {
    const xdr = await buildSacTrustTransactionXdr(sourceAccount, assetContract, network)
    return NextResponse.json({ xdr, network, assetContract })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build trustline transaction.'
    const lower = message.toLowerCase()
    if (lower.includes('simulation failed') || lower.includes('simulation error')) {
      return NextResponse.json(
        {
          error:
            'Could not prepare SAC trust transaction. Ensure your wallet is funded with XLM for fees and try again.',
          detail: message,
        },
        { status: 502 },
      )
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
