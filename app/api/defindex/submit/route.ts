import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/ramp-api'
import { getDefindexSupportedNetwork } from '@/lib/defindex/config'
import {
  defindexErrorResponse,
  requireDefindexApiConfigured,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'

export const dynamic = 'force-dynamic'

type Body = { xdr?: unknown }

/** POST /api/defindex/submit — submit a signed transaction XDR via DeFindex. */
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const apiConfigured = requireDefindexApiConfigured()
  if (!apiConfigured.ok) return apiConfigured.response

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
    return defindexErrorResponse(error, 'submit')
  }
}
