import { NextResponse } from 'next/server'
import { getRwaConfig } from '@/lib/rwa/config'
import { redeemPosition } from '@/lib/rwa/position-servicing'
import { redeemPositionSchema } from '@/lib/rwa/schemas'
import { handleRwaRoute, parseJsonBody, requireRwaAdmin } from '@/lib/rwa/route'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  const auth = await requireRwaAdmin()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const input = await parseJsonBody(request, redeemPositionSchema)
    const config = getRwaConfig()
    if (!config.registryContractId) {
      return NextResponse.json(
        { ok: false, error: 'RWA registry contract is not configured' },
        { status: 409 },
      )
    }
    const settlementId = await redeemPosition(createServiceClient(), {
      positionId: input.positionId,
      amountAtomic: input.amountAtomic,
      txHash: input.txHash,
      operationId: input.operationId,
      network: config.network,
      registryContract: config.registryContractId,
      ledger: 1,
    })
    return NextResponse.json(
      { ok: true, settlementId },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  })
}
