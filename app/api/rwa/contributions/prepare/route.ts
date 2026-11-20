import { NextResponse } from 'next/server'
import { prepareContribution } from '@/lib/rwa/contribution-intent'
import { prepareContributionSchema } from '@/lib/rwa/schemas'
import {
  createRwaDependencies,
  handleRwaRoute,
  parseJsonBody,
  requireRwaActor,
  toActor,
} from '@/lib/rwa/route'

/**
 * POST /api/rwa/contributions/prepare
 *
 * Reserve capacity for a contribution and return the contract call the
 * investor is expected to sign. The server allocates the nonce and the
 * contribution reference; the client cannot choose them.
 */
export async function POST(request: Request) {
  const auth = await requireRwaActor()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = await parseJsonBody(request, prepareContributionSchema)
    const deps = createRwaDependencies()
    const result = await prepareContribution(deps, toActor(auth), input)

    return NextResponse.json({
      ok: true,
      attemptId: result.attemptId,
      status: result.status,
      nonce: result.nonce,
      contributionRef: result.contributionRef,
      principalUnits: result.principalUnits,
      assetId: result.assetId,
      network: result.network,
      fundingPoolContractId: result.fundingPoolContractId,
      tokenContractId: result.tokenContractId,
      tokenDecimals: result.tokenDecimals,
      investorAddress: result.investorAddress,
      reservationExpiresAt: result.reservationExpiresAt,
      replayed: result.replayed,
      call: result.call,
    })
  })
}
