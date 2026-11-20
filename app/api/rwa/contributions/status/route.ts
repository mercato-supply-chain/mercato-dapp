import { NextResponse } from 'next/server'
import { getContributionStatus } from '@/lib/rwa/contribution-intent'
import { contributionStatusSchema } from '@/lib/rwa/schemas'
import {
  createRwaDependencies,
  handleRwaRoute,
  parseQuery,
  requireRwaActor,
  toActor,
} from '@/lib/rwa/route'

/**
 * GET /api/rwa/contributions/status
 *
 * Report the state of the caller's contribution attempts.
 *
 * Attempts are reported separately from confirmed positions, and only a
 * confirmed attempt is flagged as counting towards funded principal.
 */
export async function GET(request: Request) {
  const auth = await requireRwaActor()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = parseQuery(request, contributionStatusSchema)
    const deps = createRwaDependencies()
    const attempts = await getContributionStatus(deps, toActor(auth), input)

    return NextResponse.json({ ok: true, attempts })
  })
}
