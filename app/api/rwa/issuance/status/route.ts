import { NextResponse } from 'next/server'
import { issuanceDeps, reconcileIssuance } from '@/lib/rwa/issuance'
import { issuanceStatusSchema } from '@/lib/rwa/schemas'
import { handleRwaRoute, parseQuery, requireRwaAdmin, toActor } from '@/lib/rwa/route'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const auth = await requireRwaAdmin()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = parseQuery(request, issuanceStatusSchema)
    const result = await reconcileIssuance(
      issuanceDeps(createServiceClient(), toActor(auth).userId),
      input.attemptId,
    )
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  })
}
