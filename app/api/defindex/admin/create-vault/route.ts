import { NextResponse } from 'next/server'
import type { CreateVaultParams } from '@defindex/sdk'
import { requireAdmin } from '@/lib/ramp-api'
import { getDefindexSupportedNetwork } from '@/lib/defindex/config'
import { validateCreateVaultParams } from '@/lib/defindex/create-vault-validation'
import {
  defindexErrorResponse,
  requireDefindexApiConfigured,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'

export const dynamic = 'force-dynamic'

/**
 * POST /api/defindex/admin/create-vault
 * Admin-only. Builds the unsigned XDR to deploy a new vault. Sign with the same wallet as `caller`.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const apiConfigured = requireDefindexApiConfigured()
  if (!apiConfigured.ok) return apiConfigured.response

  const body = (await request.json().catch(() => null)) as
    | { config?: unknown }
    | CreateVaultParams
    | null

  const config =
    body && typeof body === 'object' && 'config' in body
      ? (body as { config: unknown }).config
      : body

  const validation = validateCreateVaultParams(config)
  if (!validation.ok) {
    return NextResponse.json({ error: `Invalid vault config: ${validation.error}` }, { status: 400 })
  }

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const tx = await sdk.createVault(validation.params, network)

    if (!tx.xdr) {
      return NextResponse.json(
        { error: 'DeFindex did not return transaction XDR for vault creation.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      xdr: tx.xdr,
      simulationResponse: tx.simulationResponse,
      network,
    })
  } catch (error) {
    return defindexErrorResponse(error, 'admin:create-vault')
  }
}
