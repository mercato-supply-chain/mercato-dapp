import { NextResponse } from 'next/server'
import { submitContribution } from '@/lib/rwa/contribution-intent'
import { submitContributionSchema } from '@/lib/rwa/schemas'
import {
  createRwaDependencies,
  handleRwaRoute,
  parseJsonBody,
  requireRwaActor,
  toActor,
} from '@/lib/rwa/route'

/**
 * POST /api/rwa/contributions/submit
 *
 * Record that the client submitted the transaction. This does not confirm
 * anything: a submitted attempt still contributes zero funded principal until
 * the chain event is verified.
 */
export async function POST(request: Request) {
  const auth = await requireRwaActor()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = await parseJsonBody(request, submitContributionSchema)
    const deps = createRwaDependencies()
    const result = await submitContribution(deps, toActor(auth), input)

    return NextResponse.json({
      ok: true,
      attemptId: result.attemptId,
      status: result.status,
      countsAsFundedPrincipal: result.status === 'confirmed',
    })
  })
}
