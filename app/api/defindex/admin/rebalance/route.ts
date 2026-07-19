import { NextResponse } from 'next/server'
import type { InstructionParam } from '@defindex/sdk'
import { requireAdmin } from '@/lib/ramp-api'
import { getDefindexSupportedNetwork, getMercatoVaultContractId } from '@/lib/defindex/config'
import {
  defindexErrorResponse,
  requireDefindexApiConfigured,
  validateCaller,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'
import { resolveMonitorVaultAddress } from '@/lib/defindex/vault-monitor'
import { isLikelyStellarContractId } from '@/lib/defindex/stellar-address'

export const dynamic = 'force-dynamic'

type RebalanceBody = {
  vault?: unknown
  caller?: unknown
  instructions?: unknown
}

function parseInstructions(value: unknown): InstructionParam[] | Response {
  if (!Array.isArray(value) || value.length === 0) {
    return NextResponse.json({ error: '`instructions` must be a non-empty array.' }, { status: 400 })
  }

  const instructions: InstructionParam[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      return NextResponse.json({ error: 'Each instruction must be an object.' }, { status: 400 })
    }
    const o = item as Record<string, unknown>
    const type = o.type

    if (type === 'Invest' || type === 'Unwind') {
      const strategyAddress =
        typeof o.strategy_address === 'string' ? o.strategy_address.trim() : ''
      const amount = typeof o.amount === 'number' ? o.amount : Number(o.amount)
      if (!isLikelyStellarContractId(strategyAddress)) {
        return NextResponse.json({ error: 'Each Invest/Unwind instruction needs a valid strategy_address.' }, { status: 400 })
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Each Invest/Unwind instruction needs a positive amount.' }, { status: 400 })
      }
      instructions.push({
        type,
        strategy_address: strategyAddress,
        amount: Math.floor(amount),
      })
      continue
    }

    return NextResponse.json(
      { error: 'Only Invest and Unwind instructions are supported from the admin UI.' },
      { status: 400 },
    )
  }

  return instructions
}

/** POST /api/defindex/admin/rebalance — admin builds unsigned rebalance XDR. */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const apiConfigured = requireDefindexApiConfigured()
  if (!apiConfigured.ok) return apiConfigured.response

  const body = (await request.json().catch(() => null)) as RebalanceBody | null
  const vaultOverride = typeof body?.vault === 'string' ? body.vault : null
  const configuredVault = getMercatoVaultContractId()
  const resolved = resolveMonitorVaultAddress(configuredVault, vaultOverride)

  if (!resolved.vaultAddress) {
    return NextResponse.json({ error: resolved.error ?? 'Vault address required.' }, { status: 400 })
  }

  const callerResult = validateCaller(body?.caller)
  if (!callerResult.ok) return callerResult.response
  const { caller } = callerResult

  const instructionsResult = parseInstructions(body?.instructions)
  if (instructionsResult instanceof Response) return instructionsResult

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()
    const tx = await sdk.rebalanceVault(
      resolved.vaultAddress,
      { caller, instructions: instructionsResult },
      network,
    )

    if (!tx.xdr) {
      return NextResponse.json(
        { error: 'DeFindex did not return transaction XDR for rebalance.' },
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
    return defindexErrorResponse(error, 'admin:rebalance')
  }
}
