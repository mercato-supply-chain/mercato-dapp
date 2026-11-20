import { NextResponse } from 'next/server'
import { z } from 'zod'
import { settleSupplier } from '@/lib/rwa/settlement'
import { supplierSettlementSchema } from '@/lib/rwa/schemas'
import {
  createRwaDependencies,
  handleRwaRoute,
  parseJsonBody,
  requireRwaAdmin,
  toActor,
} from '@/lib/rwa/route'

const settlementBodySchema = supplierSettlementSchema.extend({
  txHash: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{64}$/, 'Expected a transaction hash'),
})

/**
 * POST /api/rwa/settlements/supplier
 *
 * Record that the funding contract paid the supplier.
 *
 * The pool reaching its target only makes it ready to settle. The legacy
 * deal is moved to "supplier has been paid" exclusively after the on-chain
 * settlement event is verified, so the two states stay distinguishable.
 */
export async function POST(request: Request) {
  const auth = await requireRwaAdmin()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = await parseJsonBody(request, settlementBodySchema)
    const deps = createRwaDependencies()
    const result = await settleSupplier(deps, toActor(auth), input)

    return NextResponse.json({
      ok: true,
      assetId: result.assetId,
      lifecycle: result.lifecycle,
      replayed: result.replayed,
      fundedPrincipalUnits: result.fundedPrincipalUnits,
      targetPrincipalUnits: result.targetPrincipalUnits,
      supplierPaid: result.supplierPaid,
    })
  })
}
