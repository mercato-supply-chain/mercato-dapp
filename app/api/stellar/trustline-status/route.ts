import { NextResponse } from 'next/server'
import { Horizon } from '@stellar/stellar-sdk'
import { requireAuth } from '@/lib/api/route-auth'
import { isLikelyStellarAccountId, isLikelyStellarContractId } from '@/lib/defindex/stellar-address'
import {
  BLEND_TESTNET_USDC_CONTRACT,
  extractClassicBlendBalances,
  horizonIndicatesVaultSacTrust,
} from '@/lib/stellar/vault-asset-trustline'

export const dynamic = 'force-dynamic'

/** GET /api/stellar/trustline-status?account=G…&assetContract=C…&symbol=USDC */
export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const account = searchParams.get('account')?.trim() ?? ''
  const assetContract = searchParams.get('assetContract')?.trim() ?? ''
  const symbol = searchParams.get('symbol')?.trim() ?? undefined

  if (!account || !isLikelyStellarAccountId(account)) {
    return NextResponse.json({ error: 'Valid account (G…) is required.' }, { status: 400 })
  }
  if (!assetContract || !isLikelyStellarContractId(assetContract)) {
    return NextResponse.json({ error: 'Valid assetContract (C…) is required.' }, { status: 400 })
  }

  const network = process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  const horizonUrl =
    network === 'mainnet' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'

  try {
    const server = new Horizon.Server(horizonUrl)
    const loaded = await server.loadAccount(account)

    const allBalances = loaded.balances.map((b) => b as Record<string, unknown>)
    const classicBlendBalances = extractClassicBlendBalances(allBalances)
    const hasClassicBlendUsdc = classicBlendBalances.some((b) => b.code === 'USDC')

    const hasVaultSacTrust = horizonIndicatesVaultSacTrust(allBalances, assetContract)

    return NextResponse.json({
      /** @deprecated use hasVaultSacTrust — classic USDC ≠ SAC trust */
      hasTrustline: hasVaultSacTrust,
      hasVaultSacTrust,
      hasClassicBlendUsdc,
      classicBlendBalances,
      account,
      assetContract,
      symbol: symbol ?? null,
      vaultAssetIsSac: assetContract.startsWith('C'),
      blendSacContract: BLEND_TESTNET_USDC_CONTRACT,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load account.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
