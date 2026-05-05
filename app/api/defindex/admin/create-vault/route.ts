import { NextResponse } from 'next/server'
import type { CreateVaultParams } from '@defindex/sdk'
import { requireAdmin } from '@/lib/ramp-api'
import { defindexErrorMessage } from '@/lib/defindex/api-error'
import {
  getDefindexSupportedNetwork,
  isDefindexApiConfigured,
} from '@/lib/defindex/config'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'
import { isLikelyStellarAccountId } from '@/lib/defindex/stellar-address'

export const dynamic = 'force-dynamic'

function isCreateVaultParams(value: unknown): value is CreateVaultParams {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  if (typeof o.caller !== 'string' || !isLikelyStellarAccountId(o.caller.trim())) return false
  if (typeof o.name !== 'string' || typeof o.symbol !== 'string') return false
  if (typeof o.vaultFeeBps !== 'number' || typeof o.upgradable !== 'boolean') return false
  if (!o.roles || typeof o.roles !== 'object') return false
  if (!Array.isArray(o.assets) || o.assets.length === 0) return false
  return true
}

/**
 * POST /api/defindex/admin/create-vault
 * Admin-only. Builds the unsigned XDR to deploy a new vault. Sign with the same wallet as `caller`.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  if (!isDefindexApiConfigured()) {
    return NextResponse.json(
      { error: 'DeFindex API is not configured (set DEFINDEX_API_KEY).' },
      { status: 503 }
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { config?: unknown }
    | CreateVaultParams
    | null

  const config =
    body && typeof body === 'object' && 'config' in body
      ? (body as { config: unknown }).config
      : body

  if (!isCreateVaultParams(config)) {
    return NextResponse.json(
      {
        error:
          'Invalid vault config. Expects CreateVaultParams: caller (G…), name, symbol, vaultFeeBps, upgradable, roles, assets[].',
      },
      { status: 400 }
    )
  }

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const tx = await sdk.createVault(config, network)

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
    return NextResponse.json({ error: defindexErrorMessage(error) }, { status: 502 })
  }
}
