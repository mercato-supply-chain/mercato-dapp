import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/ramp-api'
import { getDefindexSupportedNetwork, getMercatoVaultContractId } from '@/lib/defindex/config'
import {
  defindexErrorResponse,
  parseAmounts,
  requireDefindexApiConfigured,
  resolveSlippageBps,
  validateCaller,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'
import { resolveMonitorVaultAddress } from '@/lib/defindex/vault-monitor'
import { VAULT_MIN_INIT_DEPOSIT_RAW } from '@/lib/defindex/vault-activation'

export const dynamic = 'force-dynamic'

type DepositBody = {
  vault?: unknown
  caller?: unknown
  amounts?: unknown
  invest?: unknown
  slippageBps?: unknown
}

/** POST /api/defindex/admin/deposit — admin builds unsigned deposit XDR (optional vault override). */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const apiConfigured = requireDefindexApiConfigured()
  if (!apiConfigured.ok) return apiConfigured.response

  const body = (await request.json().catch(() => null)) as DepositBody | null
  const vaultOverride = typeof body?.vault === 'string' ? body.vault : null
  const configuredVault = getMercatoVaultContractId()
  const resolved = resolveMonitorVaultAddress(configuredVault, vaultOverride)

  if (!resolved.vaultAddress) {
    return NextResponse.json({ error: resolved.error ?? 'Vault address required.' }, { status: 400 })
  }

  const callerResult = validateCaller(body?.caller)
  if (!callerResult.ok) return callerResult.response
  const { caller } = callerResult

  const amountsResult = parseAmounts(body?.amounts)
  if (!amountsResult.ok) return amountsResult.response
  const { amounts } = amountsResult

  const totalRaw = amounts.reduce((s, a) => s + a, 0)
  if (totalRaw < VAULT_MIN_INIT_DEPOSIT_RAW) {
    return NextResponse.json(
      {
        error: `Total deposit must be at least ${VAULT_MIN_INIT_DEPOSIT_RAW} stroops (DeFindex vault initialization minimum).`,
      },
      { status: 400 },
    )
  }

  const invest = typeof body?.invest === 'boolean' ? body.invest : false
  const slippageBps = resolveSlippageBps(body?.slippageBps)

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const tx = await sdk.depositToVault(
      resolved.vaultAddress,
      { caller, amounts, invest, slippageBps },
      network,
    )

    if (!tx.xdr) {
      return NextResponse.json(
        { error: 'DeFindex did not return transaction XDR for this deposit.' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      xdr: tx.xdr,
      functionName: tx.functionName,
      simulationResponse: tx.simulationResponse,
      vaultAddress: resolved.vaultAddress,
      network,
    })
  } catch (error) {
    return defindexErrorResponse(error, 'admin:deposit')
  }
}
