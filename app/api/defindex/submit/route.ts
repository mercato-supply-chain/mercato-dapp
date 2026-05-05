import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { defindexErrorMessage } from '@/lib/defindex/api-error'
import { getDefindexSupportedNetwork, isDefindexApiConfigured } from '@/lib/defindex/config'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'

export const dynamic = 'force-dynamic'

type Body = { xdr?: unknown }

/** POST /api/defindex/submit — submit a signed transaction XDR via DeFindex. */
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  if (!isDefindexApiConfigured()) {
    return NextResponse.json(
      { error: 'DeFindex API is not configured (set DEFINDEX_API_KEY).' },
      { status: 503 }
    )
  }

  const body = (await request.json().catch(() => null)) as Body | null
  const xdr = typeof body?.xdr === 'string' ? body.xdr.trim() : ''
  if (!xdr) {
    return NextResponse.json({ error: 'Signed transaction `xdr` is required.' }, { status: 400 })
  }

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const result = await sdk.sendTransaction(xdr, network)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: defindexErrorMessage(error) }, { status: 502 })
  }
}
