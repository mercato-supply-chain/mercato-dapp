import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/route-auth'
import { invalidateVaultActivityCache } from '@/lib/stellar/vault-activity-cache'

export const dynamic = 'force-dynamic'

/** POST /api/stellar/vault-activity/invalidate — invalidate server-side cache for an account+vault pair. */
export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: { account?: string; vaultAddress?: string }
  try {
    body = (await request.json()) as { account?: string; vaultAddress?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { account, vaultAddress } = body
  if (!account || !vaultAddress) {
    return NextResponse.json({ error: 'Both account and vaultAddress are required.' }, { status: 400 })
  }

  invalidateVaultActivityCache(account, vaultAddress)

  return NextResponse.json({ ok: true })
}
