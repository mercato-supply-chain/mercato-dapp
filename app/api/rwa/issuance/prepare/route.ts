import { NextResponse } from 'next/server'
import { prepareIssuance, issuanceDeps } from '@/lib/rwa/issuance'
import { prepareIssuanceSchema } from '@/lib/rwa/schemas'
import { handleRwaRoute, parseJsonBody, requireRwaAdmin, toActor } from '@/lib/rwa/route'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const auth = await requireRwaAdmin()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = await parseJsonBody(request, prepareIssuanceSchema)
    const result = await prepareIssuance(issuanceDeps(createServiceClient(), toActor(auth).userId), input)
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  })
}
