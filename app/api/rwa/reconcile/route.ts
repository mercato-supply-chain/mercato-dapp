import { NextResponse } from 'next/server'
import { reconcileOutstandingRwa } from '@/lib/rwa/reconcile'
import { createRwaDependencies, handleRwaRoute, requireRwaAdmin, toActor } from '@/lib/rwa/route'

/** Re-read issuance and contribution transactions that were submitted but not confirmed. */
export async function POST() {
  const auth = await requireRwaAdmin()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const result = await reconcileOutstandingRwa(createRwaDependencies(), toActor(auth).userId)
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  })
}
