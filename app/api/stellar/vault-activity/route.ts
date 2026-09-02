import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/route-auth'
import { getMercatoVaultContractId, isDefindexConfigured } from '@/lib/defindex/config'
import { isLikelyStellarAccountId, isLikelyStellarContractId } from '@/lib/defindex/stellar-address'
import {
  fetchVaultActivityForAccount,
  summarizeVaultActivity,
} from '@/lib/stellar/vault-activity'

export const dynamic = 'force-dynamic'

/** GET /api/stellar/vault-activity?account=G… — on-chain deposit/withdraw history for the Mercato vault. */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const account = searchParams.get('account')?.trim() ?? ''
  const cursor = searchParams.get('cursor')?.trim() || null
  const rawLimit = searchParams.get('limit')?.trim()
  const limit = rawLimit
    ? Math.min(Math.max(Number.isFinite(parseInt(rawLimit, 10)) ? parseInt(rawLimit, 10) : 20, 1), 200)
    : undefined

  if (!account || !isLikelyStellarAccountId(account)) {
    return NextResponse.json({ error: 'Valid account (G…) is required.' }, { status: 400 })
  }

  if (!isDefindexConfigured()) {
    return NextResponse.json(
      { error: 'Mercato vault is not configured (missing vault id or API key).' },
      { status: 503 },
    )
  }

  const vaultAddress = getMercatoVaultContractId()
  if (!isLikelyStellarContractId(vaultAddress)) {
    return NextResponse.json({ error: 'Invalid vault contract id in environment.' }, { status: 500 })
  }

  try {
    const result = await fetchVaultActivityForAccount({
      accountId: account,
      vaultContractId: vaultAddress,
      limit: limit ?? 20,
      cursor,
    })

    return NextResponse.json({
      vaultAddress,
      activity: result.entries,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      activitySummary: summarizeVaultActivity(result.entries),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load vault activity.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
