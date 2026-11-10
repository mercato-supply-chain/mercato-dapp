import { NextResponse } from 'next/server'
import { issuanceDeps, submitIssuance } from '@/lib/rwa/issuance'
import { submitIssuanceSchema } from '@/lib/rwa/schemas'
import { handleRwaRoute, parseJsonBody, requireRwaAdmin, toActor } from '@/lib/rwa/route'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const auth = await requireRwaAdmin()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = await parseJsonBody(request, submitIssuanceSchema)
    const result = await submitIssuance(issuanceDeps(createServiceClient(), toActor(auth).userId), input)
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  })
}
