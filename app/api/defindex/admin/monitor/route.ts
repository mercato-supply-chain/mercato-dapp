import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/ramp-api'
import { getDefindexSupportedNetwork, getMercatoVaultContractId } from '@/lib/defindex/config'
import {
  defindexErrorResponse,
  requireDefindexApiConfigured,
} from '@/lib/defindex/route-helpers'
import { getServerDefindexSdk } from '@/lib/defindex/server-sdk'
import {
  buildVaultMonitorPayload,
  resolveMonitorVaultAddress,
} from '@/lib/defindex/vault-monitor'

export const dynamic = 'force-dynamic'

/** GET /api/defindex/admin/monitor — full vault health snapshot for admins. */
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const apiConfigured = requireDefindexApiConfigured()
  if (!apiConfigured.ok) return apiConfigured.response

  const { searchParams } = new URL(request.url)
  const configuredVault = getMercatoVaultContractId()
  const resolved = resolveMonitorVaultAddress(configuredVault, searchParams.get('vault'))

  if (!resolved.vaultAddress) {
    return NextResponse.json({ error: resolved.error ?? 'Vault address required.' }, { status: 400 })
  }

  const network = getDefindexSupportedNetwork()

  try {
    const sdk = getServerDefindexSdk()

    let apiHealthy = false
    try {
      await sdk.healthCheck()
      apiHealthy = true
    } catch {
      apiHealthy = false
    }

    const [info, apyRes] = await Promise.all([
      sdk.getVaultInfo(resolved.vaultAddress, network),
      sdk.getVaultAPY(resolved.vaultAddress, network),
    ])

    const payload = buildVaultMonitorPayload(
      resolved.vaultAddress,
      configuredVault,
      apiHealthy,
      info,
      apyRes.apy,
    )

    return NextResponse.json(payload)
  } catch (error) {
    return defindexErrorResponse(error, 'admin:monitor')
  }
}
