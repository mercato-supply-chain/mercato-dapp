import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loadDealServicingSchedule } from '@/lib/rwa/position-servicing'
import { handleRwaRoute, parseQuery, requireRwaAdmin } from '@/lib/rwa/route'
import { createServiceClient } from '@/lib/supabase/service'

const schema = z.object({ dealId: z.string().uuid() })

export async function GET(request: Request) {
  const auth = await requireRwaAdmin()
  if (!auth.ok) return auth.response

  return handleRwaRoute(async () => {
    const { dealId } = parseQuery(request, schema)
    const schedule = await loadDealServicingSchedule(createServiceClient(), dealId)
    return NextResponse.json(
      { ok: true, schedule },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  })
}
