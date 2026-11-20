import { NextResponse } from 'next/server'
import { confirmContributionIntent } from '@/lib/rwa/contribution-intent'
import { confirmContributionSchema } from '@/lib/rwa/schemas'
import {
  createRwaDependencies,
  handleRwaRoute,
  parseJsonBody,
  requireRwaActor,
  toActor,
} from '@/lib/rwa/route'

/**
 * POST /api/rwa/contributions/confirm
 *
 * Verify the on-chain contribution and project it into the database.
 *
 * The server checks that the transaction succeeded and that the funding
 * contract emitted a contribution event matching the reserved intent. Only
 * then is the position written, through the protected operation, so a
 * duplicate receipt cannot be counted twice.
 */
export async function POST(request: Request) {
  const auth = await requireRwaActor()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = await parseJsonBody(request, confirmContributionSchema)
    const deps = createRwaDependencies()
    const result = await confirmContributionIntent(deps, toActor(auth), input)

    return NextResponse.json({
      ok: true,
      attemptId: result.attemptId,
      status: result.status,
      replayed: result.replayed,
      receiptId: result.receiptId,
      eventIndex: result.eventIndex,
      positionId: result.positionId,
      principalUnits: result.principalUnits,
      ownershipUnits: result.ownershipUnits,
      fundingFeeUnits: result.fundingFeeUnits,
      contributionCount: result.contributionCount,
      targetReached: result.targetReached,
      lifecycle: result.lifecycle,
      countsAsFundedPrincipal: true,
    })
  })
}
