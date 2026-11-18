import { NextResponse } from 'next/server'
import { z } from 'zod'
import { recordPositionRefund } from '@/lib/rwa/settlement'
import { refundSchema } from '@/lib/rwa/schemas'
import {
  createRwaDependencies,
  handleRwaRoute,
  parseJsonBody,
  requireRwaActor,
  toActor,
} from '@/lib/rwa/route'

const refundBodySchema = refundSchema.extend({
  txHash: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{64}$/, 'Expected a transaction hash'),
})

/**
 * POST /api/rwa/refunds
 *
 * Record a refund paid by the funding contract.
 *
 * Only the investor who owns the position can record it, and the on-chain
 * refund event must name that investor and position: the contract always
 * pays the recorded wallet.
 */
export async function POST(request: Request) {
  const auth = await requireRwaActor()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = await parseJsonBody(request, refundBodySchema)
    const deps = createRwaDependencies()
    const result = await recordPositionRefund(deps, toActor(auth), input)

    return NextResponse.json({
      ok: true,
      assetId: result.assetId,
      positionId: result.positionId,
      status: result.status,
      replayed: result.replayed,
      refundUnits: result.refundUnits,
      lifecycle: result.lifecycle,
    })
  })
}
