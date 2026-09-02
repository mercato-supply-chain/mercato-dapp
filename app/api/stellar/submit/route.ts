import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/route-auth'
import { submitSignedStellarTransactionXdr } from '@/lib/stellar/submit-signed-transaction'

export const dynamic = 'force-dynamic'

type Body = { xdr?: unknown }

/** POST /api/stellar/submit — submit a signed transaction XDR via Stellar RPC. */
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Body | null
  const xdr = typeof body?.xdr === 'string' ? body.xdr.trim() : ''
  if (!xdr) {
    return NextResponse.json({ error: 'Signed transaction `xdr` is required.' }, { status: 400 })
  }

  try {
    const result = await submitSignedStellarTransactionXdr(xdr)
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Transaction submission failed.' }, { status: 502 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit transaction.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
